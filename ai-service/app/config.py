"""
Configuration, validated once at import.

The service refuses to start in production without a shared secret, because an
unauthenticated AI service on a reachable port is an open proxy to the LLM
provider at the operator's expense.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    env: Literal["development", "test", "production"] = Field(
        default="development", alias="FB_AI_ENV"
    )
    host: str = Field(default="127.0.0.1", alias="FB_AI_HOST")
    port: int = Field(default=8000, alias="FB_AI_PORT")
    log_level: str = Field(default="info", alias="FB_AI_LOG_LEVEL")

    #: Shared secret the Node backend presents in X-Service-Token.
    service_token: str = Field(default="", alias="FB_AI_SERVICE_TOKEN")

    #: Only the Node backend should ever appear here. Never a browser origin.
    allowed_origins: str = Field(
        default="http://localhost:4000", alias="FB_AI_ALLOWED_ORIGINS"
    )

    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2", alias="FB_AI_EMBEDDING_MODEL"
    )
    #: Must match the width assumed by SchemeDocumentChunk.embedding.
    embedding_dim: int = Field(default=384, alias="FB_AI_EMBEDDING_DIM")
    enable_embeddings: bool = Field(default=True, alias="FB_AI_ENABLE_EMBEDDINGS")

    # --- LLM providers ----------------------------------------------------
    # The application is not coupled to one vendor. A task names a role; the
    # router resolves it to whichever provider is configured.
    primary_llm_provider: str = Field(default="anthropic", alias="PRIMARY_LLM_PROVIDER")
    primary_llm_model: str = Field(default="claude-sonnet-5", alias="PRIMARY_LLM_MODEL")
    secondary_llm_provider: str = Field(default="", alias="SECONDARY_LLM_PROVIDER")
    secondary_llm_model: str = Field(default="", alias="SECONDARY_LLM_MODEL")

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    google_ai_api_key: str = Field(default="", alias="GOOGLE_AI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")

    # Groq speaks the OpenAI chat-completions protocol, so it is driven through
    # the OpenAI SDK pointed at Groq's base URL rather than a bespoke client.
    groq_base_url: str = Field(
        default="https://api.groq.com/openai/v1", alias="GROQ_BASE_URL"
    )

    # The single-provider path used by llm/client.py. `llm_provider` selects
    # which vendor that path talks to; `llm_model` must be a model that vendor
    # actually serves. Groq does not host Claude, and Anthropic does not host
    # Llama, so changing one without the other will fail at request time.
    llm_provider: str = Field(default="anthropic", alias="FB_AI_LLM_PROVIDER")
    llm_model: str = Field(default="claude-sonnet-5", alias="FB_AI_LLM_MODEL")
    llm_max_tokens: int = Field(default=2048, alias="FB_AI_LLM_MAX_TOKENS")
    llm_timeout_seconds: int = Field(default=60, alias="FB_AI_LLM_TIMEOUT_SECONDS")

    max_text_chars: int = Field(default=400_000, alias="FB_AI_MAX_TEXT_CHARS")

    @field_validator("service_token")
    @classmethod
    def _token_required_in_production(cls, value: str, info) -> str:  # noqa: ANN001
        env = (info.data or {}).get("env")
        if env == "production" and not value:
            raise ValueError(
                "FB_AI_SERVICE_TOKEN is required when FB_AI_ENV=production"
            )
        if value and len(value) < 32:
            raise ValueError("FB_AI_SERVICE_TOKEN must be at least 32 characters")
        return value

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def llm_available(self) -> bool:
        """
        Whether any LLM call can be attempted.

        True when ANY provider holds a key, not just Anthropic. Every
        LLM-dependent endpoint checks this and degrades to deterministic output
        rather than failing, so the platform stays usable without any key.
        """
        return any(
            _looks_like_api_key(k)
            for k in (
                self.anthropic_api_key,
                self.openai_api_key,
                self.google_ai_api_key,
                self.groq_api_key,
            )
        )

    @property
    def is_production(self) -> bool:
        return self.env == "production"


def _looks_like_api_key(value: str) -> bool:
    """
    Whether a configured value could plausibly be an API key.

    Presence alone is not enough. A non-empty but malformed value used to make
    `llm_available` report True, so the service advertised the LLM as configured
    and every call then failed with a 401 at request time — the worst place to
    discover it. This was found in practice after a shell command was typed into
    an interactive prompt and stored as the key.

    The test is deliberately loose, because key formats change and a strict
    pattern would reject a valid future key. It rejects only what no API key can
    ever be: empty, whitespace-containing, or far too short.
    """
    v = value.strip()
    if not v:
        return False
    if any(c.isspace() for c in v):
        return False
    return len(v) >= 20

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached so the .env file is read once per process."""
    return Settings()
