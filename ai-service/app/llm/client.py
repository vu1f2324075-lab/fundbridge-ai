"""
LLM client.

Every call is optional. When no API key is configured, when the provider is
unreachable, or when the response fails validation, callers receive `None` and
fall back to deterministic output. The platform must stay usable without an LLM,
so no feature is allowed to depend on one.

The API key lives here and is never interpolated into a prompt.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from ..config import get_settings

logger = logging.getLogger(__name__)

#: Retried once at most. An LLM call is expensive and a failing provider should
#: surface quickly rather than being hammered.
MAX_ATTEMPTS = 2

#: Some models wrap JSON in a fence despite being told not to. Tolerated on
#: parse rather than treated as a failure.
_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)


class LlmUnavailable(RuntimeError):
    """No usable LLM response. Callers degrade rather than propagate."""


def is_available() -> bool:
    return get_settings().llm_available


def model_name() -> str | None:
    settings = get_settings()
    return settings.llm_model if settings.llm_available else None


def _extract_json(raw: str) -> dict[str, Any]:
    """
    Parses a JSON object out of a model response.

    Tolerates a code fence and leading prose, but requires a single object. If
    the model has been talked into returning something else, this raises and the
    caller falls back — which is the designed behaviour, not an error path to
    paper over.
    """
    text = raw.strip()

    fenced = _FENCE.match(text)
    if fenced:
        text = fenced.group(1).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Last resort: the outermost brace-delimited span.
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise LlmUnavailable("response contained no JSON object") from None
        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LlmUnavailable(f"response was not valid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise LlmUnavailable("response JSON was not an object")
    return parsed


#: Anything shaped like a provider credential. Applied to error text before it
#: is logged or wrapped, so a key can never reach a log file via an exception
#: message. Providers do not normally echo the key back, but "normally" is not
#: a guarantee worth betting a credential on.
_SECRET_RE = re.compile(
    '(?<![A-Za-z0-9])(?:gsk|sk-ant|sk-proj|sk|AIza)[A-Za-z0-9_-]{12,}',
    re.IGNORECASE,
)


def _redact(value: object) -> str:
    """Stringifies a value with anything key-shaped replaced."""
    return _SECRET_RE.sub("<redacted>", str(value))


# --- Transports -------------------------------------------------------------
#
# One function per vendor, each returning raw assistant text. They are kept
# deliberately thin and identical in contract so `complete_json` owns the retry
# loop, the JSON extraction and the error vocabulary in exactly one place.
#
# Temperature is 0.2 everywhere: low enough to be near-reproducible, high enough
# to avoid the degenerate repetition that temperature 0 can produce.
#
# The system prompt is always passed through the vendor's dedicated system
# channel, never concatenated into the user turn, so the security rules stay
# structurally separate from untrusted document content.


def _send_anthropic(settings: Any, system: str, user: str, max_tokens: int) -> str:
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover
        raise LlmUnavailable("anthropic package is not installed") from exc

    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=float(settings.llm_timeout_seconds),
        max_retries=0,  # retry loop in complete_json, so failures log per attempt
    )
    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        temperature=0.2,
    )
    return "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )


def _send_groq(settings: Any, system: str, user: str, max_tokens: int) -> str:
    """
    Groq via the OpenAI SDK.

    Groq implements the OpenAI chat-completions protocol, so the official
    OpenAI client works unchanged against their base URL. That is why there is
    no separate Groq SDK dependency.

    `response_format={"type": "json_object"}` is requested because every caller
    here wants a JSON object back. Groq honours it on the supported models, and
    `_extract_json` still guards the response either way — a model that ignores
    the instruction must not be able to crash the caller.
    """
    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover
        raise LlmUnavailable("openai package is not installed") from exc

    client = OpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.groq_base_url,
        timeout=float(settings.llm_timeout_seconds),
        max_retries=0,
    )
    response = client.chat.completions.create(
        model=settings.llm_model,
        max_tokens=max_tokens,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    choices = response.choices or []
    if not choices:
        return ""
    return choices[0].message.content or ""


#: Vendor name -> transport. `complete_json` rejects anything not listed here
#: rather than silently falling back to a default vendor.
_SEND = {
    "anthropic": _send_anthropic,
    "groq": _send_groq,
}


def complete_json(system: str, user: str, *, max_tokens: int | None = None) -> dict[str, Any]:
    """
    Sends one completion and returns the parsed JSON object.

    Raises `LlmUnavailable` for every failure mode — missing key, transport
    error, provider error, unparseable output — so callers have exactly one
    exception type to handle.
    """
    settings = get_settings()
    if not settings.llm_available:
        raise LlmUnavailable("no API key configured")

    provider = (settings.llm_provider or "anthropic").strip().lower()
    if provider not in _SEND:
        raise LlmUnavailable(f"unknown LLM provider {provider!r}")

    send = _SEND[provider]
    last_error: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            text = send(settings, system, user, max_tokens or settings.llm_max_tokens)
            if not text.strip():
                raise LlmUnavailable("response contained no text")

            return _extract_json(text)

        except LlmUnavailable as exc:
            last_error = exc
            logger.warning("llm attempt %d produced unusable output: %s", attempt, _redact(exc))
        except Exception as exc:
            last_error = exc
            # The provider error is logged but never returned to the caller: it
            # can contain request details, and the user cannot act on it.
            logger.warning("llm attempt %d failed: %s", attempt, exc.__class__.__name__)

    raise LlmUnavailable(f"all {MAX_ATTEMPTS} attempts failed: {_redact(last_error)}")
