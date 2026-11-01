"""
LLM provider abstraction.

The application must not be coupled to one vendor. Every provider implements the
same narrow interface, so swapping one for another is a configuration change
rather than a code change.

The interface is deliberately small — one method that returns a validated JSON
object. Everything this system asks an LLM for is structured, because free prose
cannot be validated, and unvalidated model output must never reach the database.

Providers are constructed lazily. An unconfigured provider costs nothing and
never imports its SDK, so a deployment with only one vendor's key does not need
the others installed.
"""

from __future__ import annotations

import json
import logging

from ..config import get_settings
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

#: Tolerated on parse even though prompts forbid it — some models fence anyway.
_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)


class LlmError(RuntimeError):
    """Any failure to obtain usable output. Callers degrade rather than raise."""


class LlmNotConfigured(LlmError):
    """No credentials for this provider."""


@dataclass
class LlmResult:
    """
    A successful completion plus the metadata needed for reproducibility.

    Token counts are recorded when the provider reports them, because cost and
    context pressure are operational facts worth observing — but they are never
    required, since not every provider returns them.
    """

    data: dict[str, Any]
    provider: str
    model: str
    prompt_version: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def extract_json(raw: str) -> dict[str, Any]:
    """
    Parses a JSON object out of a model response.

    Raises rather than returning a partial result. A model that has been talked
    into returning prose fails here, and the caller falls back to deterministic
    output — which is the designed behaviour, not an error to paper over.
    """
    text = (raw or "").strip()
    if not text:
        raise LlmError("response was empty")

    fenced = _FENCE.match(text)
    if fenced:
        text = fenced.group(1).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Last resort: the outermost brace-delimited span.
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise LlmError("response contained no JSON object") from None
        try:
            parsed = json.loads(text[start : start + (end - start) + 1])
        except json.JSONDecodeError as exc:
            raise LlmError(f"response was not valid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise LlmError("response JSON was not an object")
    return parsed


class LlmProvider(ABC):
    """One completion backend."""

    #: Stable identifier recorded against generated results.
    name: str = "abstract"

    @abstractmethod
    def is_configured(self) -> bool:
        """Whether credentials are present. Must not perform any network call."""

    @abstractmethod
    def default_model(self) -> str:
        ...

    @abstractmethod
    def generate_json(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
        timeout_seconds: int = 60,
    ) -> LlmResult:
        """
        Sends one completion and returns the parsed JSON object.

        Must raise `LlmError` for every failure mode so callers handle exactly
        one exception type.
        """


class AnthropicProvider(LlmProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._client: Any = None

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def default_model(self) -> str:
        return self._model

    def _get_client(self, timeout_seconds: int) -> Any:
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:
                raise LlmNotConfigured("the anthropic package is not installed") from exc
            self._client = anthropic.Anthropic(
                api_key=self._api_key,
                timeout=float(timeout_seconds),
                # Retries are handled by the router so each attempt is logged.
                max_retries=0,
            )
        return self._client

    def generate_json(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
        timeout_seconds: int = 60,
    ) -> LlmResult:
        if not self.is_configured():
            raise LlmNotConfigured("no Anthropic API key configured")

        import time

        client = self._get_client(timeout_seconds)
        started = time.perf_counter()

        try:
            response = client.messages.create(
                model=model or self._model,
                max_tokens=max_tokens,
                # The API keeps the system prompt structurally separate from
                # user content, which is what the injection defence relies on.
                system=system,
                messages=[{"role": "user", "content": user}],
                temperature=temperature,
            )
        except Exception as exc:
            # The class name only: a provider error can echo request detail.
            raise LlmError(f"anthropic request failed: {exc.__class__.__name__}") from exc

        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        usage = getattr(response, "usage", None)

        return LlmResult(
            data=extract_json(text),
            provider=self.name,
            model=model or self._model,
            prompt_version="",  # set by the router
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class OpenAiProvider(LlmProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str, base_url: str | None = None) -> None:
        self._api_key = api_key
        self._model = model
        #: Set for OpenAI-compatible vendors such as Groq; None uses OpenAI's own.
        self._base_url = base_url
        self._client: Any = None

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def default_model(self) -> str:
        return self._model

    def generate_json(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
        timeout_seconds: int = 60,
    ) -> LlmResult:
        if not self.is_configured():
            raise LlmNotConfigured("no OpenAI API key configured")

        import time

        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as exc:
                raise LlmNotConfigured("the openai package is not installed") from exc
            kwargs: dict[str, Any] = {
                "api_key": self._api_key,
                "timeout": float(timeout_seconds),
                "max_retries": 0,
            }
            if self._base_url:
                kwargs["base_url"] = self._base_url
            self._client = OpenAI(**kwargs)

        started = time.perf_counter()
        try:
            response = self._client.chat.completions.create(
                model=model or self._model,
                max_tokens=max_tokens,
                temperature=temperature,
                # Provider-side JSON enforcement where available. Output is
                # still validated locally — this reduces retries, it does not
                # replace validation.
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except Exception as exc:
            raise LlmError(f"openai request failed: {exc.__class__.__name__}") from exc

        text = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)

        return LlmResult(
            data=extract_json(text),
            provider=self.name,
            model=model or self._model,
            prompt_version="",
            input_tokens=getattr(usage, "prompt_tokens", None),
            output_tokens=getattr(usage, "completion_tokens", None),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class GeminiProvider(LlmProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def default_model(self) -> str:
        return self._model

    def generate_json(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
        timeout_seconds: int = 60,
    ) -> LlmResult:
        if not self.is_configured():
            raise LlmNotConfigured("no Google AI API key configured")

        import time

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise LlmNotConfigured("the google-genai package is not installed") from exc

        client = genai.Client(api_key=self._api_key)
        started = time.perf_counter()

        try:
            response = client.models.generate_content(
                model=model or self._model,
                contents=user,
                config=types.GenerateContentConfig(
                    # Gemini carries the system prompt as a dedicated field, so
                    # the same separation holds here.
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                    temperature=temperature,
                    response_mime_type="application/json",
                ),
            )
        except Exception as exc:
            raise LlmError(f"gemini request failed: {exc.__class__.__name__}") from exc

        usage = getattr(response, "usage_metadata", None)
        return LlmResult(
            data=extract_json(response.text or ""),
            provider=self.name,
            model=model or self._model,
            prompt_version="",
            input_tokens=getattr(usage, "prompt_token_count", None),
            output_tokens=getattr(usage, "candidates_token_count", None),
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


class MockProvider(LlmProvider):
    """
    Deterministic provider for tests.

    Returns whatever it is given, so a test can exercise the full routing,
    validation and fallback path without a network call or an API key. It is
    never selected unless explicitly configured.
    """

    name = "mock"

    def __init__(self, responses: dict[str, dict[str, Any]] | None = None) -> None:
        self._responses = responses or {}
        self.calls: list[dict[str, str]] = []
        #: Set to raise on the next call, to test the fallback path.
        self.fail_next = False

    def is_configured(self) -> bool:
        return True

    def default_model(self) -> str:
        return "mock-model"

    def set_response(self, key: str, value: dict[str, Any]) -> None:
        self._responses[key] = value

    def generate_json(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.2,
        timeout_seconds: int = 60,
    ) -> LlmResult:
        self.calls.append({"system": system, "user": user})

        if self.fail_next:
            self.fail_next = False
            raise LlmError("mock provider was told to fail")

        # Keyed on whichever configured response the prompt matches, so one mock
        # can serve several task types in a single test.
        for key, value in self._responses.items():
            if key in system or key in user:
                return LlmResult(
                    data=value,
                    provider=self.name,
                    model=model or "mock-model",
                    prompt_version="",
                )

        default = self._responses.get("__default__")
        if default is None:
            raise LlmError("mock provider has no configured response")
        return LlmResult(data=default, provider=self.name, model=model or "mock-model", prompt_version="")


def build_provider(kind: str, api_key: str, model: str) -> LlmProvider | None:
    """
    Constructs a provider by name, or None for an unknown/blank kind.

    Returns None rather than raising: an unconfigured secondary provider is a
    normal deployment, not an error.
    """
    normalised = (kind or "").strip().lower()
    if not normalised or normalised == "none":
        return None
    if normalised == "anthropic":
        return AnthropicProvider(api_key, model)
    if normalised == "openai":
        return OpenAiProvider(api_key, model)
    if normalised == "groq":
        # Groq speaks the OpenAI protocol, so the same provider serves it with
        # a different base URL. Kept in step with llm/client.py, which is the
        # path the endpoints actually use.
        return OpenAiProvider(api_key, model, base_url=get_settings().groq_base_url)
    if normalised in {"gemini", "google"}:
        return GeminiProvider(api_key, model)
    if normalised == "mock":
        return MockProvider()
    logger.warning("unknown LLM provider %r; ignoring", kind)
    return None
