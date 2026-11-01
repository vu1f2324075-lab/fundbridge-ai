"""
Proposal analysis.

The division of labour here is the point of the whole design:

    SCORES      are computed deterministically from measurable properties of the
                document. The LLM never produces a number.
    NARRATIVE   (strengths, weaknesses, suggestions) may be phrased by an LLM
                from the document, validated on the way back, and falls back to
                deterministic findings when unavailable.

So a score is always reproducible and always explainable, and the system works
with no LLM at all — the prose is simply plainer.
"""

from __future__ import annotations

import logging
import re

from ..config import get_settings
from ..llm import client as llm
from ..llm.prompts import PROPOSAL_ANALYSIS_SYSTEM, wrap_document
from ..nlp.cleaning import clean_text, detect_sections, missing_sections, word_count
from ..schemas import (
    AnalyseProposalRequest,
    ImprovementSuggestion,
    ProposalAnalysisResponse,
    ProposalScores,
    SECTION_LABELS,
)

logger = logging.getLogger(__name__)

MODEL_VERSION = "proposal-analysis-v1"

#: Below this a document is too short to assess meaningfully.
MIN_USEFUL_WORDS = 150
#: Word count at which the length component saturates.
TARGET_WORDS = 1200

#: Sections weighted by how much assessors rely on them. Completeness is scored
#: against these weights rather than a flat count, so a proposal missing its
#: financials is penalised more than one missing a risks section.
_SECTION_WEIGHTS: dict[str, float] = {
    "executive_summary": 1.2,
    "problem": 1.2,
    "solution": 1.2,
    "market": 1.1,
    "business_model": 1.0,
    "competition": 0.7,
    "traction": 1.1,
    "team": 1.0,
    "financials": 1.3,
    "funding_requirement": 1.3,
    "use_of_funds": 1.2,
    "implementation_plan": 0.8,
    "risks": 0.6,
}

#: Evidence markers. Presence of concrete figures is what separates an evidenced
#: claim from an assertion, and is measurable without understanding the text.
_CURRENCY = re.compile(r"(?:₹|rs\.?|inr|\$|usd)\s?[\d,]+(?:\.\d+)?\s*(?:lakh|lakhs|crore|cr|k|m|mn|million|bn)?", re.IGNORECASE)
_PERCENT = re.compile(r"\b\d{1,3}(?:\.\d+)?\s?%")
_MULTIPLE = re.compile(r"\b\d+(?:\.\d+)?\s?x\b", re.IGNORECASE)
_COUNT_WITH_NOUN = re.compile(
    r"\b\d[\d,]*\s+(?:customers?|clients?|users?|subscribers?|orders?|units?|dealers?|outlets?|pilots?|employees?|staff)\b",
    re.IGNORECASE,
)
_DATE = re.compile(r"\b(?:20\d{2}|19\d{2})\b|\b(?:q[1-4]\s?20\d{2})\b", re.IGNORECASE)

_FINANCIAL_TERMS = (
    "revenue", "turnover", "profit", "loss", "margin", "ebitda", "cash flow",
    "burn", "runway", "break-even", "breakeven", "expenses", "cogs", "capex",
    "opex", "valuation", "projection", "forecast", "balance sheet",
)
_MARKET_TERMS = (
    "market size", "tam", "sam", "som", "addressable", "cagr", "growth rate",
    "survey", "research", "pilot", "case study", "benchmark", "industry report",
)
_TEAM_TERMS = (
    "founder", "co-founder", "cofounder", "experience", "years", "previously",
    "led", "managed", "qualified", "degree", "expertise", "advisor", "mentor",
)
_FUNDING_TERMS = (
    "use of funds", "allocation", "deploy", "utilis", "utiliz", "breakdown",
    "working capital", "equipment", "hiring", "marketing", "milestone",
)

#: Hedging without substance. A proposal built on these reads as speculation.
_VAGUE_TERMS = (
    "world class", "world-class", "best in class", "revolutionary", "disruptive",
    "cutting edge", "cutting-edge", "state of the art", "huge potential",
    "massive market", "unlimited", "guaranteed", "no competition",
    "first of its kind", "game changer", "game-changing",
)


def _count_terms(text: str, terms: tuple[str, ...]) -> int:
    lowered = text.lower()
    return sum(1 for t in terms if t in lowered)


def _bounded(value: float) -> int:
    return int(max(0, min(100, round(value))))


# ---------------------------------------------------------------------------
# Deterministic component scores
# ---------------------------------------------------------------------------


def _completeness_score(sections: dict[str, str]) -> int:
    total = sum(_SECTION_WEIGHTS.values())
    earned = sum(
        weight
        for name, weight in _SECTION_WEIGHTS.items()
        # A heading with no body does not count as a section.
        if name in sections and len(sections[name].strip()) >= 40
    )
    return _bounded((earned / total) * 100)


def _structure_score(text: str, sections: dict[str, str], words: int) -> int:
    if words < MIN_USEFUL_WORDS:
        return _bounded((words / MIN_USEFUL_WORDS) * 40)

    # Detected headings are the primary signal of a navigable document.
    heading_ratio = min(1.0, len(sections) / 8)
    score = heading_ratio * 55

    paragraphs = [p for p in text.split("\n\n") if len(p.strip()) > 40]
    if paragraphs:
        score += 20
        avg = sum(word_count(p) for p in paragraphs) / len(paragraphs)
        # 30-130 words per paragraph reads as structured prose; a wall of text
        # or a stream of fragments does not.
        if 30 <= avg <= 130:
            score += 15

    # Any list formatting at all.
    if re.search(r"^\s*(?:[-•*]|\d+[\.\)])\s+\S", text, re.MULTILINE):
        score += 10

    return _bounded(score)


def _clarity_score(text: str, words: int) -> int:
    if words < MIN_USEFUL_WORDS:
        return _bounded((words / MIN_USEFUL_WORDS) * 40)

    score = 60.0

    sentences = [s for s in re.split(r"(?<=[.!?])\s+", text) if len(s.split()) >= 3]
    if sentences:
        avg_len = sum(len(s.split()) for s in sentences) / len(sentences)
        # 12-24 words per sentence is comfortable business prose.
        if 12 <= avg_len <= 24:
            score += 20
        elif 8 <= avg_len <= 32:
            score += 10
        else:
            score -= 10

    # Vague superlatives actively reduce clarity: they occupy space where a
    # specific claim should be.
    vague = _count_terms(text, _VAGUE_TERMS)
    score -= min(25, vague * 5)

    # Concrete figures anywhere in the document.
    concrete = (
        len(_CURRENCY.findall(text))
        + len(_PERCENT.findall(text))
        + len(_COUNT_WITH_NOUN.findall(text))
    )
    score += min(20, concrete * 2)

    return _bounded(score)


def _market_evidence_score(text: str, sections: dict[str, str]) -> int:
    scope = sections.get("market", "") + "\n" + sections.get("traction", "")
    # Fall back to the whole document: evidence outside a labelled section still
    # counts as evidence.
    if len(scope.strip()) < 80:
        scope = text

    score = 0.0
    score += min(30, _count_terms(scope, _MARKET_TERMS) * 7)
    score += min(25, len(_COUNT_WITH_NOUN.findall(scope)) * 8)
    score += min(20, len(_PERCENT.findall(scope)) * 5)
    score += min(15, len(_CURRENCY.findall(scope)) * 4)
    if _DATE.search(scope):
        score += 10
    return _bounded(score)


def _financial_score(text: str, sections: dict[str, str]) -> int:
    scope = sections.get("financials", "")
    if len(scope.strip()) < 80:
        scope = text

    score = 0.0
    score += min(35, _count_terms(scope, _FINANCIAL_TERMS) * 6)
    score += min(30, len(_CURRENCY.findall(scope)) * 5)
    score += min(15, len(_PERCENT.findall(scope)) * 4)
    # A projection needs a time dimension; a single year is not a projection.
    if len(set(_DATE.findall(scope))) >= 2:
        score += 20
    elif _DATE.search(scope):
        score += 8
    return _bounded(score)


def _funding_justification_score(text: str, sections: dict[str, str]) -> int:
    scope = (
        sections.get("funding_requirement", "")
        + "\n"
        + sections.get("use_of_funds", "")
    )
    has_section = len(scope.strip()) >= 60
    if not has_section:
        scope = text

    score = 25.0 if has_section else 0.0
    score += min(25, _count_terms(scope, _FUNDING_TERMS) * 6)

    amounts = len(_CURRENCY.findall(scope))
    # A single total is a request; several figures is a breakdown.
    if amounts >= 3:
        score += 30
    elif amounts >= 1:
        score += 15

    if _PERCENT.search(scope):
        score += 10
    if re.search(r"^\s*(?:[-•*]|\d+[\.\)])\s+\S", scope, re.MULTILINE):
        score += 10

    return _bounded(score)


def _team_score(text: str, sections: dict[str, str]) -> int:
    scope = sections.get("team", "")
    has_section = len(scope.strip()) >= 60
    if not has_section:
        scope = text

    score = 25.0 if has_section else 0.0
    score += min(35, _count_terms(scope, _TEAM_TERMS) * 6)
    if re.search(r"\b\d+\+?\s*years?\b", scope, re.IGNORECASE):
        score += 20
    if _COUNT_WITH_NOUN.search(scope):
        score += 10
    # A plausible proper-noun name, as a weak signal that people are identified.
    if re.search(r"\b[A-Z][a-z]+\s+[A-Z][a-z]+\b", scope):
        score += 10
    return _bounded(score)


#: Overall weighting. Documented here rather than spread across call sites so
#: the composition can be reviewed in one place.
_OVERALL_WEIGHTS: dict[str, float] = {
    "completeness": 0.22,
    "funding_justification": 0.18,
    "financial": 0.16,
    "market_evidence": 0.16,
    "clarity": 0.12,
    "structure": 0.09,
    "team": 0.07,
}


def compute_scores(text: str, sections: dict[str, str]) -> ProposalScores:
    words = word_count(text)

    components = {
        "clarity": _clarity_score(text, words),
        "completeness": _completeness_score(sections),
        "structure": _structure_score(text, sections, words),
        "market_evidence": _market_evidence_score(text, sections),
        "financial": _financial_score(text, sections),
        "funding_justification": _funding_justification_score(text, sections),
        "team": _team_score(text, sections),
    }

    overall = sum(components[k] * w for k, w in _OVERALL_WEIGHTS.items())

    # A document too short to assess cannot score well on composition, whatever
    # the individual components say.
    if words < MIN_USEFUL_WORDS:
        overall = min(overall, 30)
    elif words < TARGET_WORDS:
        overall *= 0.85 + 0.15 * (words / TARGET_WORDS)

    return ProposalScores(overall=_bounded(overall), **components)


# ---------------------------------------------------------------------------
# Deterministic findings — the fallback when no LLM is available
# ---------------------------------------------------------------------------


def _deterministic_findings(
    text: str, sections: dict[str, str], scores: ProposalScores
) -> tuple[list[str], list[str], list[ImprovementSuggestion]]:
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[ImprovementSuggestion] = []

    present = [SECTION_LABELS[s] for s in sections if s in SECTION_LABELS]
    if len(present) >= 8:
        strengths.append(
            f"The document is well organised, with {len(present)} of the expected sections present."
        )
    if scores.financial >= 70:
        strengths.append("Financial information is specific, with concrete figures rather than general claims.")
    if scores.market_evidence >= 70:
        strengths.append("Market claims are supported by measurable evidence.")
    if scores.funding_justification >= 70:
        strengths.append("The funding request is broken down rather than stated as a single total.")
    if scores.clarity >= 75:
        strengths.append("The writing is clear and concrete, avoiding unsupported superlatives.")

    checks: list[tuple[bool, str, str, str, str, str]] = [
        (
            scores.completeness < 70,
            "Completeness",
            "Several sections a funding assessor expects are absent or very brief.",
            "Add the missing sections listed in this analysis, even briefly.",
            "An assessor who cannot find a section often treats the information as unavailable.",
            "HIGH",
        ),
        (
            scores.financial < 60,
            "Financial information",
            "Financial detail is thin: few concrete figures or no time dimension.",
            "State revenue, expenses and profit or loss for at least two periods, and label the periods.",
            "Nearly every funder and scheme treats documented financials as a prerequisite.",
            "HIGH",
        ),
        (
            scores.funding_justification < 60,
            "Use of funds",
            "The funding requirement is not justified with a breakdown.",
            "Split the amount across specific uses with an amount against each, and say what each unlocks.",
            "A total with no breakdown gives an assessor no basis to judge whether the amount is reasonable.",
            "HIGH",
        ),
        (
            scores.market_evidence < 60,
            "Market evidence",
            "Market claims are asserted rather than evidenced.",
            "Add measurable evidence: customer numbers, pilot results, survey findings or a cited industry figure.",
            "Evidence of real demand is what distinguishes a plan from an idea.",
            "MEDIUM",
        ),
        (
            scores.team < 55,
            "Team",
            "The document does not establish why this team can execute this plan.",
            "Name the key people, give their relevant years of experience, and link each to a responsibility.",
            "Assessors fund teams as much as plans.",
            "MEDIUM",
        ),
        (
            scores.structure < 60,
            "Structure",
            "The document is hard to navigate: few clear headings or inconsistent formatting.",
            "Add a heading per section and keep paragraphs short.",
            "A document that is hard to skim is often read only partly.",
            "LOW",
        ),
        (
            scores.clarity < 60,
            "Clarity",
            "The writing leans on general claims where a specific statement would be stronger.",
            "Replace phrases like 'huge potential' with the figure or fact behind the claim.",
            "Specific statements can be verified; general ones are discounted.",
            "MEDIUM",
        ),
    ]

    for failing, area, issue, suggestion, why, severity in checks:
        if failing:
            weaknesses.append(issue)
            suggestions.append(
                ImprovementSuggestion(
                    area=area,
                    issue=issue,
                    suggestion=suggestion,
                    why_it_matters=why,
                    severity=severity,  # type: ignore[arg-type]
                )
            )

    vague = [t for t in _VAGUE_TERMS if t in text.lower()]
    if vague:
        weaknesses.append(
            "The document uses unsupported superlatives: " + ", ".join(sorted(vague)[:4]) + "."
        )

    if not strengths:
        strengths.append(
            "No individual section scored strongly yet, so there is substantial room to improve "
            "with targeted edits rather than a rewrite."
        )

    return strengths, weaknesses, suggestions


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _llm_findings(
    request: AnalyseProposalRequest, text: str, sections: dict[str, str]
) -> tuple[list[str], list[str], list[ImprovementSuggestion]] | None:
    """
    Asks the LLM for narrative findings only.

    Returns None on any failure, which makes the caller fall back silently to
    deterministic findings. The LLM is never asked for a score.
    """
    context_lines = [
        "Analyse the proposal below and report findings.",
        f"Sections detected: {', '.join(sections) or 'none'}.",
    ]
    if request.industry:
        context_lines.append(f"Business industry (context only): {request.industry}")
    if request.business_stage:
        context_lines.append(f"Business stage (context only): {request.business_stage}")
    if request.requested_amount:
        currency = request.currency or "INR"
        context_lines.append(
            f"Amount requested (context only): {request.requested_amount:,.0f} {currency}"
        )

    user = "\n".join(context_lines) + "\n\n" + wrap_document(text)

    try:
        payload = llm.complete_json(PROPOSAL_ANALYSIS_SYSTEM, user)
    except llm.LlmUnavailable as exc:
        logger.info("proposal analysis falling back to deterministic findings: %s", exc)
        return None

    try:
        strengths = [str(s)[:500] for s in payload.get("strengths", []) if str(s).strip()][:6]
        weaknesses = [str(s)[:500] for s in payload.get("weaknesses", []) if str(s).strip()][:6]

        suggestions: list[ImprovementSuggestion] = []
        for raw in payload.get("suggestions", [])[:6]:
            if not isinstance(raw, dict):
                continue
            # Validated through the Pydantic model, so a malformed or
            # over-length entry is dropped rather than stored.
            suggestions.append(ImprovementSuggestion(**raw))
    except Exception as exc:
        logger.warning("llm findings failed validation: %s", exc)
        return None

    if not strengths and not weaknesses and not suggestions:
        return None

    return strengths, weaknesses, suggestions


def analyse_proposal(request: AnalyseProposalRequest) -> ProposalAnalysisResponse:
    settings = get_settings()

    text = clean_text(request.text)[: settings.max_text_chars]
    sections = detect_sections(text)
    scores = compute_scores(text, sections)

    det_strengths, det_weaknesses, det_suggestions = _deterministic_findings(text, sections, scores)

    strengths, weaknesses, suggestions = det_strengths, det_weaknesses, det_suggestions
    llm_assisted = False
    note: str | None = None

    if request.use_llm:
        if not llm.is_available():
            note = (
                "AI-assisted narrative is unavailable because no language model is configured. "
                "Scores and findings below were computed deterministically."
            )
        else:
            result = _llm_findings(request, text, sections)
            if result is None:
                note = (
                    "The language model could not be reached, so findings below were computed "
                    "deterministically. Scores are unaffected — they are always computed by rule."
                )
            else:
                llm_strengths, llm_weaknesses, llm_suggestions = result
                # Deterministic suggestions are kept alongside the model's: they
                # are tied to the scores and should not disappear because a model
                # chose to emphasise something else.
                strengths = llm_strengths or det_strengths
                weaknesses = llm_weaknesses or det_weaknesses
                seen = {s.area.lower() for s in llm_suggestions}
                suggestions = llm_suggestions + [s for s in det_suggestions if s.area.lower() not in seen]
                llm_assisted = True

    return ProposalAnalysisResponse(
        scores=scores,
        strengths=strengths,
        weaknesses=weaknesses,
        missing_sections=[SECTION_LABELS.get(s, s) for s in missing_sections(sections)],
        suggestions=suggestions[:10],
        detected_sections=list(sections.keys()),
        word_count=word_count(text),
        llm_assisted=llm_assisted,
        model_version=MODEL_VERSION,
        llm_note=note,
    )
