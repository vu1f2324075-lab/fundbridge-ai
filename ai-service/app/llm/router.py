"""
AI task router.

One place that decides, per task: which provider, which model, what temperature,
how many tokens, and what happens on failure. Call sites name a *task*, never a
model — so retuning or replacing a model is a change here and nowhere else.

Temperature is set per task rather than globally. Factual work runs near zero
because a government funding figure must not vary between runs; only proposal
rewriting gets any latitude.

Every result carries provider, model and prompt version, which is what makes a
stored AI-assisted output reproducible.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any

from ..config import get_settings
from .providers import LlmError, LlmProvider, LlmResult, build_provider

logger = logging.getLogger(__name__)


class AiTask(str, Enum):
    """Every LLM-backed task. Call sites reference these, never a model name."""

    PROPOSAL_ANALYSIS = "proposal_analysis"
    PROPOSAL_SECTION = "proposal_section"
    GROUNDED_EXPLANATION = "grounded_explanation"
    RAG_ANSWER = "rag_answer"
    MATCH_EXPLANATION = "match_explanation"
    ACTION_PLAN = "action_plan"


@dataclass(frozen=True)
class TaskPolicy:
    """Per-task generation settings."""

    temperature: float
    max_tokens: int
    prompt_version: str
    #: Whether to try the secondary provider when the primary fails. False for
    #: tasks where a deterministic fallback already exists and is adequate.
    allow_fallback: bool
    #: Attempts against a single provider before moving on.
    max_attempts: int = 2


#: Temperatures are deliberately low. A scheme's stated eligibility must read
#: the same way twice; variation there is a defect, not creativity.
TASK_POLICIES: dict[AiTask, TaskPolicy] = {
    # Factual grounding. Near-deterministic.
    AiTask.GROUNDED_EXPLANATION: TaskPolicy(
        temperature=0.1, max_tokens=1536, prompt_version="grounded_explanation_v1", allow_fallback=True
    ),
    AiTask.RAG_ANSWER: TaskPolicy(
        temperature=0.1, max_tokens=2048, prompt_version="rag_answer_v1", allow_fallback=True
    ),
    AiTask.MATCH_EXPLANATION: TaskPolicy(
        temperature=0.1, max_tokens=1024, prompt_version="match_explanation_v1", allow_fallback=True
    ),
    # Analysis of a document. Low, but needs some room to phrase findings.
    AiTask.PROPOSAL_ANALYSIS: TaskPolicy(
        temperature=0.2,
        max_tokens=2048,
        prompt_version="proposal_analysis_v1",
        # A deterministic analyser already covers this, so a second paid call
        # buys little.
        allow_fallback=False,
    ),
    AiTask.ACTION_PLAN: TaskPolicy(
        temperature=0.2, max_tokens=1536, prompt_version="action_plan_v1", allow_fallback=False
    ),
    # Drafting prose. The only task with meaningful latitude.
    AiTask.PROPOSAL_SECTION: TaskPolicy(
        temperature=0.4, max_tokens=1536, prompt_version="proposal_section_v1", allow_fallback=False
    ),
}


class AiRouter:
    """
    Routes a task to a provider, with retry and optional fallback.

    Providers are built once and reused. An unconfigured secondary is simply
    absent, which is a normal single-vendor deployment.
    """

    def __init__(
        self,
        primary: LlmProvider | None = None,
        secondary: LlmProvider | None = None,
    ) -> None:
        settings = get_settings()

        if primary is None:
            primary = build_provider(
                settings.primary_llm_provider,
                _key_for(settings.primary_llm_provider, settings),
                settings.primary_llm_model,
            )
        if secondary is None:
            secondary = build_provider(
                settings.secondary_llm_provider,
                _key_for(settings.secondary_llm_provider, settings),
                settings.secondary_llm_model,
            )

        self._primary = primary
        self._secondary = secondary
        self._timeout = settings.llm_timeout_seconds

    # -- capability ---------------------------------------------------------

    def is_available(self) -> bool:
        """True when at least one provider holds credentials."""
        return any(p is not None and p.is_configured() for p in (self._primary, self._secondary))

    def describe(self) -> dict[str, Any]:
        """Capability report, for the health endpoint and the admin screen."""

        def info(p: LlmProvider | None) -> dict[str, Any] | None:
            if p is None:
                return None
            return {"provider": p.name, "model": p.default_model(), "configured": p.is_configured()}

        return {
            "available": self.is_available(),
            "primary": info(self._primary),
            "secondary": info(self._secondary),
            "tasks": {
                task.value: {
                    "temperature": policy.temperature,
                    "maxTokens": policy.max_tokens,
                    "promptVersion": policy.prompt_version,
                    "allowFallback": policy.allow_fallback,
                }
                for task, policy in TASK_POLICIES.items()
            },
        }

    # -- execution ----------------------------------------------------------

    def run(self, task: AiTask, *, system: str, user: str) -> LlmResult:
        """
        Executes one task.

        Raises `LlmError` when every configured provider has failed, so callers
        have one exception type and fall back to deterministic output.
        """
        policy = TASK_POLICIES[task]
        chain: list[LlmProvider] = []

        if self._primary is not None and self._primary.is_configured():
            chain.append(self._primary)
        if policy.allow_fallback and self._secondary is not None and self._secondary.is_configured():
            chain.append(self._secondary)

        if not chain:
            raise LlmError("no LLM provider is configured")

        last: Exception | None = None

        for provider in chain:
            for attempt in range(1, policy.max_attempts + 1):
                started = time.perf_counter()
                try:
                    result = provider.generate_json(
                        system=system,
                        user=user,
                        max_tokens=policy.max_tokens,
                        temperature=policy.temperature,
                        timeout_seconds=self._timeout,
                    )
                    # Stamped here rather than in the provider: the router owns
                    # the prompt version, the provider only transports text.
                    result.prompt_version = policy.prompt_version
                    result.metadata["task"] = task.value
                    result.metadata["attempt"] = attempt

                    logger.info(
                        "ai task=%s provider=%s model=%s attempt=%d latency=%sms in=%s out=%s",
                        task.value,
                        result.provider,
                        result.model,
                        attempt,
                        result.latency_ms,
                        result.input_tokens,
                        result.output_tokens,
                    )
                    return result

                except LlmError as exc:
                    last = exc
                    elapsed = int((time.perf_counter() - started) * 1000)
                    # Logged without prompt or response content: both can carry
                    # the user's private business information.
                    logger.warning(
                        "ai task=%s provider=%s attempt=%d failed after %sms: %s",
                        task.value,
                        provider.name,
                        attempt,
                        elapsed,
                        exc,
                    )
                    if attempt < policy.max_attempts:
                        # Brief linear backoff. Deliberately not aggressive —
                        # a user is waiting on this request.
                        time.sleep(0.5 * attempt)

        raise LlmError(f"all providers failed for {task.value}: {last}")


def _key_for(provider_kind: str, settings: Any) -> str:
    """Maps a provider name to its configured key."""
    kind = (provider_kind or "").strip().lower()
    if kind == "anthropic":
        return settings.anthropic_api_key
    if kind == "openai":
        return settings.openai_api_key
    if kind in {"gemini", "google"}:
        return settings.google_ai_api_key
    return ""


_router: AiRouter | None = None


def get_router() -> AiRouter:
    """Process-wide router. Providers are constructed once."""
    global _router
    if _router is None:
        _router = AiRouter()
    return _router


def reset_router() -> None:
    """Clears the cached router. Used by tests that swap providers."""
    global _router
    _router = None
