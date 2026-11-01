"""
Router and provider-abstraction tests.

Uses MockProvider throughout, so the full routing, retry, fallback and
validation path is exercised with no network call and no API key — which is also
the configuration most deployments of this project will run in.
"""

from __future__ import annotations

import pytest

from app.llm.providers import (
    LlmError,
    LlmNotConfigured,
    MockProvider,
    build_provider,
    extract_json,
)
from app.llm.router import TASK_POLICIES, AiRouter, AiTask


class TestExtractJson:
    def test_parses_a_plain_object(self):
        assert extract_json('{"a": 1}') == {"a": 1}

    def test_tolerates_a_code_fence(self):
        # Prompts forbid fences, but some models add them anyway.
        assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
        assert extract_json('```\n{"a": 1}\n```') == {"a": 1}

    def test_recovers_an_object_from_surrounding_prose(self):
        assert extract_json('Here is the result: {"a": 1} Hope that helps.') == {"a": 1}

    def test_rejects_prose_with_no_object(self):
        # A model talked into answering in prose must fail, so the caller falls
        # back rather than storing something unvalidated.
        with pytest.raises(LlmError):
            extract_json("I cannot comply with that request.")

    def test_rejects_a_json_array(self):
        with pytest.raises(LlmError):
            extract_json("[1, 2, 3]")

    def test_rejects_empty_output(self):
        for value in ["", "   ", "\n"]:
            with pytest.raises(LlmError):
                extract_json(value)

    def test_rejects_malformed_json(self):
        with pytest.raises(LlmError):
            extract_json('{"a": 1,,}')


class TestBuildProvider:
    def test_builds_each_known_provider(self):
        for kind in ("anthropic", "openai", "gemini", "google", "mock"):
            assert build_provider(kind, "key", "model") is not None

    def test_returns_none_for_blank_or_none(self):
        # An unconfigured secondary provider is a normal deployment.
        for kind in ("", "   ", "none", "NONE"):
            assert build_provider(kind, "", "") is None

    def test_returns_none_for_an_unknown_provider(self):
        assert build_provider("not-a-real-provider", "key", "model") is None

    def test_is_case_insensitive(self):
        assert build_provider("Anthropic", "key", "model") is not None

    def test_an_unkeyed_provider_reports_unconfigured(self):
        provider = build_provider("anthropic", "", "claude-sonnet-5")
        assert provider is not None
        assert provider.is_configured() is False

    def test_an_unconfigured_provider_raises_rather_than_calling_out(self):
        provider = build_provider("anthropic", "", "claude-sonnet-5")
        assert provider is not None
        with pytest.raises(LlmNotConfigured):
            provider.generate_json(system="s", user="u")


class TestRouterAvailability:
    def test_reports_unavailable_with_no_providers(self):
        router = AiRouter(primary=None, secondary=None)
        assert router.is_available() is False
        assert router.describe()["available"] is False

    def test_reports_available_with_a_mock_primary(self):
        router = AiRouter(primary=MockProvider({"__default__": {"ok": True}}))
        assert router.is_available() is True

    def test_raises_when_nothing_is_configured(self):
        router = AiRouter(primary=None, secondary=None)
        with pytest.raises(LlmError, match="no LLM provider"):
            router.run(AiTask.RAG_ANSWER, system="s", user="u")

    def test_describe_lists_every_task(self):
        tasks = AiRouter(primary=None).describe()["tasks"]
        for task in AiTask:
            assert task.value in tasks


class TestRouting:
    def test_returns_provider_output_with_metadata(self):
        mock = MockProvider({"__default__": {"narrative": "text"}})
        router = AiRouter(primary=mock)

        result = router.run(AiTask.RAG_ANSWER, system="sys", user="usr")

        assert result.data == {"narrative": "text"}
        assert result.provider == "mock"
        # The router owns the prompt version, not the provider.
        assert result.prompt_version == TASK_POLICIES[AiTask.RAG_ANSWER].prompt_version
        assert result.metadata["task"] == "rag_answer"

    def test_passes_the_prompts_through_unaltered(self):
        mock = MockProvider({"__default__": {"ok": True}})
        AiRouter(primary=mock).run(AiTask.RAG_ANSWER, system="SYSTEM-TEXT", user="USER-TEXT")

        assert mock.calls[0]["system"] == "SYSTEM-TEXT"
        assert mock.calls[0]["user"] == "USER-TEXT"

    def test_retries_the_same_provider_before_giving_up(self):
        mock = MockProvider({"__default__": {"ok": True}})
        mock.fail_next = True

        result = AiRouter(primary=mock).run(AiTask.RAG_ANSWER, system="s", user="u")

        # First attempt failed, second succeeded.
        assert result.data == {"ok": True}
        assert len(mock.calls) == 2
        assert result.metadata["attempt"] == 2


class TestFallback:
    def test_falls_back_to_the_secondary_for_a_fallback_task(self):
        primary = MockProvider()  # no configured response -> always fails
        secondary = MockProvider({"__default__": {"from": "secondary"}})

        # RAG_ANSWER allows fallback.
        assert TASK_POLICIES[AiTask.RAG_ANSWER].allow_fallback is True
        result = AiRouter(primary=primary, secondary=secondary).run(
            AiTask.RAG_ANSWER, system="s", user="u"
        )

        assert result.data == {"from": "secondary"}

    def test_does_not_fall_back_for_a_task_with_a_deterministic_alternative(self):
        primary = MockProvider()
        secondary = MockProvider({"__default__": {"from": "secondary"}})

        # Proposal analysis already has a deterministic analyser, so a second
        # paid call buys little.
        assert TASK_POLICIES[AiTask.PROPOSAL_ANALYSIS].allow_fallback is False
        with pytest.raises(LlmError):
            AiRouter(primary=primary, secondary=secondary).run(
                AiTask.PROPOSAL_ANALYSIS, system="s", user="u"
            )
        assert secondary.calls == []

    def test_raises_when_every_provider_fails(self):
        router = AiRouter(primary=MockProvider(), secondary=MockProvider())
        with pytest.raises(LlmError, match="all providers failed"):
            router.run(AiTask.RAG_ANSWER, system="s", user="u")

    def test_never_fabricates_a_response_on_total_failure(self):
        # The contract that matters: failure raises, so the caller degrades.
        # It must never return a plausible-looking empty object.
        router = AiRouter(primary=MockProvider())
        with pytest.raises(LlmError):
            router.run(AiTask.RAG_ANSWER, system="s", user="u")


class TestTaskPolicies:
    def test_every_task_has_a_policy(self):
        for task in AiTask:
            assert task in TASK_POLICIES

    def test_factual_tasks_run_at_low_temperature(self):
        # A stated government figure must read the same way twice.
        for task in (AiTask.GROUNDED_EXPLANATION, AiTask.RAG_ANSWER, AiTask.MATCH_EXPLANATION):
            assert TASK_POLICIES[task].temperature <= 0.1

    def test_no_task_uses_high_randomness(self):
        for task, policy in TASK_POLICIES.items():
            assert policy.temperature <= 0.4, f"{task.value} temperature too high"

    def test_drafting_has_more_latitude_than_grounding(self):
        assert (
            TASK_POLICIES[AiTask.PROPOSAL_SECTION].temperature
            > TASK_POLICIES[AiTask.GROUNDED_EXPLANATION].temperature
        )

    def test_every_policy_has_a_versioned_prompt_and_bounded_tokens(self):
        for task, policy in TASK_POLICIES.items():
            assert policy.prompt_version.endswith("_v1"), task.value
            assert 0 < policy.max_tokens <= 4096
            assert policy.max_attempts >= 1


class TestGroqProvider:
    """
    Groq is driven through the OpenAI SDK against Groq's base URL, because Groq
    implements the OpenAI chat-completions protocol. These cover the wiring,
    not the network.
    """

    def test_build_provider_accepts_groq(self):
        from app.llm.providers import build_provider

        provider = build_provider("groq", "gsk_" + "x" * 48, "llama-3.3-70b-versatile")
        assert provider is not None
        assert provider.is_configured()
        assert provider.default_model() == "llama-3.3-70b-versatile"

    def test_groq_key_makes_llm_available(self, monkeypatch):
        from app import config

        config.get_settings.cache_clear()
        monkeypatch.setenv("GROQ_API_KEY", "gsk_" + "y" * 48)
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        try:
            assert config.get_settings().llm_available is True
        finally:
            config.get_settings.cache_clear()

    def test_malformed_groq_key_is_not_available(self, monkeypatch):
        """A value that cannot be a key must not advertise the LLM as ready."""
        from app import config

        config.get_settings.cache_clear()
        monkeypatch.setenv("GROQ_API_KEY", r".\stop.ps1; .\start.ps1")
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("GOOGLE_AI_API_KEY", raising=False)
        try:
            assert config.get_settings().llm_available is False
        finally:
            config.get_settings.cache_clear()

    def test_client_dispatches_to_the_configured_vendor(self, monkeypatch):
        """
        The transport is chosen by FB_AI_LLM_PROVIDER, not by which key happens
        to be present. Mixing Groq's key with Anthropic's transport would fail
        at request time, so the mapping is asserted here.
        """
        from app.llm import client

        assert set(client._SEND) == {"anthropic", "groq"}

        captured = {}

        def fake_groq(settings, system, user, max_tokens):
            captured["model"] = settings.llm_model
            captured["system"] = system
            return '{"ok": true}'

        monkeypatch.setitem(client._SEND, "groq", fake_groq)
        monkeypatch.setattr(client, "get_settings", lambda: _Settings())

        result = client.complete_json("SYSTEM RULES", "user text")
        assert result == {"ok": True}
        assert captured["model"] == "llama-3.3-70b-versatile"
        # The system prompt must reach the vendor's own system channel intact.
        assert captured["system"] == "SYSTEM RULES"

    def test_unknown_provider_is_refused(self, monkeypatch):
        from app.llm import client

        class Bad(_Settings):
            llm_provider = "not-a-vendor"

        monkeypatch.setattr(client, "get_settings", lambda: Bad())
        with pytest.raises(client.LlmUnavailable):
            client.complete_json("s", "u")


class _Settings:
    """Minimal stand-in for the settings object the client reads."""

    llm_available = True
    llm_provider = "groq"
    llm_model = "llama-3.3-70b-versatile"
    llm_max_tokens = 2048
    llm_timeout_seconds = 60
    groq_api_key = "gsk_" + "z" * 48
    groq_base_url = "https://api.groq.com/openai/v1"
    anthropic_api_key = ""
