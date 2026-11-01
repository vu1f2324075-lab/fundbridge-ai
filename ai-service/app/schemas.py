"""
Request and response contracts.

Every LLM output is parsed into one of these models before it leaves the
service. That is the enforcement point for the rule that unvalidated model
output must never reach the database: if the model returns prose, an extra
field, or a score outside range, parsing fails and the caller gets a
deterministic fallback instead.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


class StrictModel(BaseModel):
    """Rejects unexpected fields rather than silently dropping them."""

    model_config = ConfigDict(extra="forbid")


Severity = Literal["HIGH", "MEDIUM", "LOW"]

#: Sections a funding proposal is expected to contain. Used for both section
#: detection and the missing-section report.
EXPECTED_SECTIONS: tuple[str, ...] = (
    "executive_summary",
    "problem",
    "solution",
    "market",
    "business_model",
    "competition",
    "traction",
    "team",
    "financials",
    "funding_requirement",
    "use_of_funds",
    "implementation_plan",
    "risks",
)

SECTION_LABELS: dict[str, str] = {
    "executive_summary": "Executive summary",
    "problem": "Problem statement",
    "solution": "Solution",
    "market": "Market opportunity",
    "business_model": "Business model",
    "competition": "Competitive landscape",
    "traction": "Traction and evidence",
    "team": "Team",
    "financials": "Financial information",
    "funding_requirement": "Funding requirement",
    "use_of_funds": "Use of funds",
    "implementation_plan": "Implementation plan",
    "risks": "Risks",
}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    #: Reported so the backend can tell the UI what is genuinely available
    #: rather than the UI assuming.
    embeddings_available: bool
    embedding_model: str | None
    embedding_dim: int
    llm_available: bool
    llm_model: str | None


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


class EmbedRequest(StrictModel):
    texts: list[str] = Field(min_length=1, max_length=256)

    @field_validator("texts")
    @classmethod
    def _non_empty(cls, value: list[str]) -> list[str]:
        cleaned = [t for t in value if t and t.strip()]
        if not cleaned:
            raise ValueError("at least one non-empty text is required")
        return cleaned


class EmbedResponse(BaseModel):
    model: str
    dim: int
    #: One vector per input text, in the same order.
    embeddings: list[list[float]]


class SimilarityRequest(StrictModel):
    query: str = Field(min_length=1)
    candidates: list[str] = Field(min_length=1, max_length=512)


class SimilarityScore(BaseModel):
    index: int
    #: Cosine similarity mapped from [-1,1] into [0,1] so it can be used
    #: directly as a factor score without the caller rescaling it.
    score: float


class SimilarityResponse(BaseModel):
    model: str
    scores: list[SimilarityScore]


# ---------------------------------------------------------------------------
# Document extraction
# ---------------------------------------------------------------------------


class ExtractResponse(BaseModel):
    #: Cleaned plain text. Never returned to a browser directly; the backend
    #: stores it and renders it as text, never as HTML.
    text: str
    word_count: int
    page_count: int | None
    #: Detected section name -> excerpt.
    sections: dict[str, str]
    detected_sections: list[str]
    missing_sections: list[str]
    #: True when the file parsed but contained almost no extractable text,
    #: which usually means a scanned image. Reported rather than silently
    #: producing an empty analysis.
    likely_scanned: bool
    warnings: list[str]


# ---------------------------------------------------------------------------
# Proposal analysis
# ---------------------------------------------------------------------------


class ImprovementSuggestion(StrictModel):
    area: str = Field(min_length=1, max_length=120)
    issue: str = Field(min_length=1, max_length=600)
    suggestion: str = Field(min_length=1, max_length=900)
    why_it_matters: str = Field(min_length=1, max_length=600)
    severity: Severity


class ProposalScores(BaseModel):
    overall: int = Field(ge=0, le=100)
    clarity: int = Field(ge=0, le=100)
    completeness: int = Field(ge=0, le=100)
    structure: int = Field(ge=0, le=100)
    market_evidence: int = Field(ge=0, le=100)
    financial: int = Field(ge=0, le=100)
    funding_justification: int = Field(ge=0, le=100)
    team: int = Field(ge=0, le=100)


class AnalyseProposalRequest(StrictModel):
    text: str = Field(min_length=1)
    #: Optional context used only to tailor wording. The analyser never asserts
    #: a fact about the business that is not in the document itself.
    industry: str | None = None
    business_stage: str | None = None
    requested_amount: float | None = None
    currency: str | None = None
    #: When false, skip the LLM entirely and return deterministic output only.
    use_llm: bool = True


class ProposalAnalysisResponse(BaseModel):
    scores: ProposalScores
    strengths: list[str]
    weaknesses: list[str]
    missing_sections: list[str]
    suggestions: list[ImprovementSuggestion]
    detected_sections: list[str]
    word_count: int
    #: True only when an LLM actually contributed. Stored against the analysis
    #: so a reader can tell which parts were model-phrased.
    llm_assisted: bool
    model_version: str
    #: Present when the LLM was requested but unavailable or rejected, so the
    #: caller can surface honest degradation instead of silence.
    llm_note: str | None = None


# ---------------------------------------------------------------------------
# Proposal section assistance
# ---------------------------------------------------------------------------


class SuggestSectionRequest(StrictModel):
    section: str = Field(min_length=1, max_length=64)
    #: What the user has written so far, if anything.
    current_text: str | None = None
    #: Facts the backend read from the database. The model may use ONLY these;
    #: it is instructed not to introduce any other figure or claim.
    known_facts: dict[str, str] = Field(default_factory=dict)


class SuggestSectionResponse(BaseModel):
    section: str
    #: Draft text, clearly AI-assisted. May be None when the LLM is unavailable.
    draft: str | None
    guidance: list[str]
    #: Facts the section needs that were not supplied, so the UI can ask the
    #: user rather than letting the model invent them.
    missing_facts: list[str]
    llm_assisted: bool
    llm_note: str | None = None


# ---------------------------------------------------------------------------
# RAG
# ---------------------------------------------------------------------------


class ChunkRequest(StrictModel):
    text: str = Field(min_length=1)
    chunk_size: int = Field(default=900, ge=200, le=4000)
    chunk_overlap: int = Field(default=150, ge=0, le=1000)

    @field_validator("chunk_overlap")
    @classmethod
    def _overlap_smaller_than_size(cls, value: int, info) -> int:  # noqa: ANN001
        size = (info.data or {}).get("chunk_size", 900)
        if value >= size:
            # Equal or larger overlap would make chunking fail to advance.
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return value


class Chunk(BaseModel):
    index: int
    text: str
    #: Nearest preceding heading, carried through so a citation can point at a
    #: location a human can find in the source document.
    heading: str | None
    token_estimate: int


class ChunkResponse(BaseModel):
    chunks: list[Chunk]


class RagContextItem(StrictModel):
    """One retrieved chunk, supplied by the backend from its own database."""

    chunk_id: str
    scheme_id: str | None = None
    scheme_name: str | None = None
    document_title: str
    source_url: str
    source_type: str
    last_verified_at: str | None = None
    text: str = Field(min_length=1)
    similarity: float


class GroundedExplanationRequest(StrictModel):
    #: The deterministic explanation object the matching engine produced. The
    #: model may rephrase this and nothing else.
    explanation: dict
    #: Retrieved official context, used for grounding only.
    context: list[RagContextItem] = Field(default_factory=list)
    question: str | None = None


class Citation(BaseModel):
    chunk_id: str
    document_title: str
    source_url: str
    last_verified_at: str | None


class GroundedExplanationResponse(BaseModel):
    #: None when the LLM is unavailable; the caller then renders the structured
    #: explanation directly, which is always sufficient on its own.
    narrative: str | None
    citations: list[Citation]
    llm_assisted: bool
    llm_note: str | None = None


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
