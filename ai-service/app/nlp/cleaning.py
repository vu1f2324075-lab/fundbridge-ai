"""
Text cleaning and section detection.

Both operate on untrusted document content. Nothing here interprets the text as
an instruction — it is only normalised, measured and segmented.
"""

from __future__ import annotations

import re
import unicodedata

from ..schemas import EXPECTED_SECTIONS

#: Characters that carry no meaning in extracted text but break tokenisation and
#: can be used to smuggle hidden text past a human reviewer. Zero-width joiners,
#: BOM, and the bidirectional-override characters used in homoglyph attacks.
_INVISIBLE = re.compile(r"[​-‏‪-‮⁠-⁤﻿]")

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

#: Three or more newlines collapse to a paragraph break.
_EXCESS_NEWLINES = re.compile(r"\n{3,}")
_TRAILING_SPACE = re.compile(r"[ \t]+\n")
_EXCESS_SPACE = re.compile(r"[ \t]{2,}")

#: A line that is only digits, or "Page 3 of 12" — PDF furniture that adds noise
#: to embeddings without adding meaning.
_PAGE_FURNITURE = re.compile(
    r"^\s*(?:page\s+\d+(?:\s+of\s+\d+)?|\d+\s*/\s*\d+|\d{1,4})\s*$",
    re.IGNORECASE,
)


def clean_text(raw: str) -> str:
    """
    Normalises extracted document text.

    Unicode is normalised to NFKC so visually identical characters compare
    equal, which matters because an attacker can otherwise write an instruction
    using lookalike characters that a naive filter misses.
    """
    if not raw:
        return ""

    text = unicodedata.normalize("NFKC", raw)
    text = _INVISIBLE.sub("", text)
    text = _CONTROL.sub(" ", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    lines = [line for line in text.split("\n") if not _PAGE_FURNITURE.match(line)]
    text = "\n".join(lines)

    text = _TRAILING_SPACE.sub("\n", text)
    text = _EXCESS_SPACE.sub(" ", text)
    text = _EXCESS_NEWLINES.sub("\n\n", text)

    return text.strip()


def word_count(text: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", text))


def looks_scanned(text: str, page_count: int | None) -> bool:
    """
    Heuristic for an image-only PDF.

    A scanned document extracts to almost nothing. Reporting that is far better
    than running an analysis over 20 characters and returning a confident score.
    """
    words = word_count(text)
    if page_count and page_count > 0:
        # Fewer than 20 words per page is well below any real prose document.
        return words / page_count < 20
    return words < 50


# ---------------------------------------------------------------------------
# Section detection
# ---------------------------------------------------------------------------

#: Heading synonyms per canonical section. Ordered longest-first within each
#: list so "use of funds" is tried before "funds".
_SECTION_PATTERNS: dict[str, tuple[str, ...]] = {
    "executive_summary": ("executive summary", "overview", "summary", "introduction", "abstract"),
    "problem": ("problem statement", "the problem", "problem", "pain point", "challenge", "need"),
    "solution": ("our solution", "the solution", "solution", "product", "service", "offering", "what we do"),
    "market": (
        "market opportunity",
        "market analysis",
        "target market",
        "market size",
        "market",
        "industry analysis",
        "opportunity",
    ),
    "business_model": ("business model", "revenue model", "how we make money", "monetisation", "monetization", "pricing"),
    "competition": ("competitive landscape", "competitive advantage", "competition", "competitors", "differentiation"),
    "traction": ("traction", "milestones achieved", "achievements", "customers", "validation", "progress", "pilots"),
    "team": ("our team", "the team", "team", "founders", "management", "leadership", "key personnel"),
    "financials": (
        "financial projections",
        "financial information",
        "financials",
        "financial plan",
        "projections",
        "revenue",
        "profit and loss",
        "unit economics",
    ),
    "funding_requirement": (
        "funding requirement",
        "funding request",
        "funding required",
        "investment required",
        "capital required",
        "the ask",
        "amount requested",
    ),
    "use_of_funds": ("use of funds", "fund utilisation", "fund utilization", "allocation of funds", "deployment of funds", "how funds will be used"),
    "implementation_plan": (
        "implementation plan",
        "execution plan",
        "roadmap",
        "timeline",
        "go to market",
        "go-to-market",
        "operational plan",
        "action plan",
    ),
    "risks": ("risk analysis", "risks and mitigation", "risk factors", "risks", "challenges and risks", "mitigation"),
}


def _looks_like_heading(line: str) -> bool:
    """
    Whether a line is plausibly a heading.

    Headings are short, not sentences, and often numbered or capitalised. The
    length bound is what stops a body paragraph that happens to begin with
    "The problem" from being treated as a section start.
    """
    stripped = line.strip()
    if not stripped or len(stripped) > 90:
        return False
    # A line ending in a full stop is almost always prose.
    if stripped.endswith((".", ",", ";", ":")) and len(stripped) > 60:
        return False
    words = stripped.split()
    # A heading is short. 12 words was too generous: a wrapped body line of
    # exactly 12 words was being accepted, and then matched a one-word section
    # pattern by prefix.
    if len(words) > 8:
        return False

    # Mid-sentence punctuation means prose, not a heading. Leading enumeration
    # is stripped first, so a numbered heading like "1. Executive Summary" is
    # not mistaken for a sentence on the strength of its own numbering.
    body = re.sub(r"^\s*(?:\d+|[ivxlc]+)[\.\)]\s*", "", stripped, flags=re.IGNORECASE)
    if re.search(r"[.!?]\s+\w", body):
        return False

    return True


def _normalise_heading(line: str) -> str:
    """Strips numbering, bullets and punctuation so synonyms compare cleanly."""
    text = line.strip().lower()
    text = re.sub(r"^[\s\-•\*#>]+", "", text)
    text = re.sub(r"^\d+[\.\)]?\s*", "", text)
    text = re.sub(r"^[ivxlc]+[\.\)]\s*", "", text)
    text = re.sub(r"[^a-z0-9\s&/-]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_sections(text: str) -> dict[str, str]:
    """
    Splits a document into canonical sections by detecting headings.

    Returns canonical name -> body text. A section claimed by two headings keeps
    the first occurrence, since proposals often repeat a word later in prose.
    """
    if not text:
        return {}

    lines = text.split("\n")
    # (line index, canonical section)
    boundaries: list[tuple[int, str]] = []
    claimed: set[str] = set()

    for i, line in enumerate(lines):
        if not _looks_like_heading(line):
            continue
        normalised = _normalise_heading(line)
        if not normalised:
            continue

        for section, patterns in _SECTION_PATTERNS.items():
            if section in claimed:
                continue
            for pattern in patterns:
                # Exact match, or the heading starts with the pattern AND is not
                # much longer than it.
                #
                # The length guard is essential. Without it a wrapped body line
                # beginning "management. We are seeking Rs 50,00,000 to expand..."
                # matched the one-word "management" pattern by prefix and opened
                # a spurious Team section, stealing the following lines from the
                # section they belonged to.
                if normalised == pattern:
                    boundaries.append((i, section))
                    claimed.add(section)
                    break
                if normalised.startswith(pattern + " "):
                    extra = len(normalised.split()) - len(pattern.split())
                    # "Use of Funds Breakdown" (one extra word) still matches;
                    # a sentence does not.
                    if extra <= 3:
                        boundaries.append((i, section))
                        claimed.add(section)
                        break
            else:
                continue
            break

    if not boundaries:
        return {}

    boundaries.sort(key=lambda b: b[0])

    sections: dict[str, str] = {}
    for idx, (line_no, section) in enumerate(boundaries):
        end = boundaries[idx + 1][0] if idx + 1 < len(boundaries) else len(lines)
        body = "\n".join(lines[line_no + 1 : end]).strip()
        if body:
            sections[section] = body

    return sections


def missing_sections(detected: dict[str, str] | list[str]) -> list[str]:
    """Expected sections that were not found, in canonical order."""
    found = set(detected if isinstance(detected, list) else detected.keys())
    return [s for s in EXPECTED_SECTIONS if s not in found]
