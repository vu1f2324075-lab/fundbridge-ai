"""Tests for text cleaning, section detection and chunking."""

from __future__ import annotations

from app.nlp.cleaning import (
    clean_text,
    detect_sections,
    looks_scanned,
    missing_sections,
    word_count,
)
from app.rag.chunking import chunk_text, scheme_record_to_text


class TestCleanText:
    def test_strips_zero_width_and_bidi_characters(self):
        # These can hide text from a human reviewer while remaining in the
        # string a model sees.
        dirty = "Normal​text‌with﻿invisible‮chars"
        cleaned = clean_text(dirty)
        for ch in ("​", "‌", "﻿", "‮"):
            assert ch not in cleaned
        assert "Normal" in cleaned and "text" in cleaned

    def test_normalises_unicode_lookalikes(self):
        # NFKC folds full-width characters, so a filter cannot be bypassed by
        # writing an instruction in lookalike glyphs.
        assert "Revenue" in clean_text("Ｒｅｖｅｎｕｅ")

    def test_removes_control_characters(self):
        assert "\x00" not in clean_text("text\x00with\x07control")

    def test_collapses_excess_whitespace(self):
        assert clean_text("a\n\n\n\n\nb") == "a\n\nb"
        assert clean_text("a      b") == "a b"

    def test_strips_page_furniture(self):
        cleaned = clean_text("Real content here\nPage 3 of 12\n42\nMore real content")
        assert "Page 3 of 12" not in cleaned
        assert "Real content here" in cleaned
        assert "More real content" in cleaned

    def test_handles_empty_input(self):
        assert clean_text("") == ""
        assert clean_text("   \n\n  ") == ""

    def test_preserves_currency_and_numbers(self):
        text = "Revenue was Rs 35,00,000 (35%) across 14 customers in 2025."
        cleaned = clean_text(text)
        for fragment in ("35,00,000", "35%", "14 customers", "2025"):
            assert fragment in cleaned


class TestWordCount:
    def test_counts_words_not_characters(self):
        assert word_count("one two three") == 3

    def test_counts_hyphenated_and_apostrophised_words_as_one(self):
        assert word_count("state-of-the-art") == 1
        assert word_count("don't") == 1

    def test_ignores_punctuation(self):
        assert word_count("Hello, world! How are you?") == 5


class TestLooksScanned:
    def test_detects_image_only_pdf(self):
        # 10 pages, almost no text.
        assert looks_scanned("a few words only", page_count=10) is True

    def test_accepts_a_real_text_document(self):
        text = " ".join(["word"] * 500)
        assert looks_scanned(text, page_count=5) is False

    def test_handles_unknown_page_count(self):
        assert looks_scanned("short", page_count=None) is True
        assert looks_scanned(" ".join(["word"] * 200), page_count=None) is False


class TestSectionDetection:
    PROPOSAL = """Executive Summary

BuildTech Solutions provides technology for construction equipment management.
We are seeking funding to expand operations across Maharashtra.

Problem Statement

Construction firms lose working days to unplanned equipment downtime and have
very little visibility into utilisation across multiple sites.

Our Solution

An IoT and mobile platform that tracks equipment condition and flags maintenance
before failure occurs.

Market Opportunity

The Indian construction technology market is growing at 18% annually according
to industry reports. We target mid-sized contractors.

Financial Projections

Revenue in 2025 was Rs 35,00,000 against expenses of Rs 34,00,000.
We project Rs 80,00,000 in 2026.

Use of Funds

Rs 20,00,000 for product development, Rs 15,00,000 for hiring and
Rs 15,00,000 for marketing.
"""

    def test_detects_sections_by_heading(self):
        sections = detect_sections(self.PROPOSAL)
        for expected in (
            "executive_summary",
            "problem",
            "solution",
            "market",
            "financials",
            "use_of_funds",
        ):
            assert expected in sections, f"missing {expected}"

    def test_section_bodies_exclude_the_heading(self):
        sections = detect_sections(self.PROPOSAL)
        assert "Problem Statement" not in sections["problem"]
        assert "unplanned equipment downtime" in sections["problem"]

    def test_reports_sections_that_are_absent(self):
        missing = missing_sections(detect_sections(self.PROPOSAL))
        # None of these appear in the fixture.
        for expected in ("team", "competition", "risks"):
            assert expected in missing

    def test_does_not_treat_prose_mentioning_a_keyword_as_a_heading(self):
        text = (
            "The problem with most existing approaches is that they require manual "
            "data entry across several disconnected systems, which teams abandon."
        )
        # A long sentence is not a heading, so no section should be opened.
        assert detect_sections(text) == {}

    def test_handles_numbered_headings(self):
        text = "1. Executive Summary\n\nWe build things that work well.\n\n2. Problem\n\nThings break often."
        sections = detect_sections(text)
        assert "executive_summary" in sections
        assert "problem" in sections

    def test_ignores_a_heading_with_no_body(self):
        # A bare heading does not mean the section is present.
        assert "risks" not in detect_sections("Risks\n")

    def test_handles_empty_input(self):
        assert detect_sections("") == {}


class TestChunking:
    def test_returns_nothing_for_empty_text(self):
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text_becomes_one_chunk(self):
        chunks = chunk_text("A short paragraph of text.", chunk_size=900)
        assert len(chunks) == 1
        assert chunks[0].index == 0

    def test_long_text_is_split(self):
        text = "\n\n".join(f"Paragraph {i}. " + "word " * 60 for i in range(12))
        chunks = chunk_text(text, chunk_size=500, chunk_overlap=80)
        assert len(chunks) > 1
        assert [c.index for c in chunks] == list(range(len(chunks)))

    def test_chunks_respect_the_size_budget(self):
        text = "\n\n".join("word " * 50 for _ in range(20))
        chunks = chunk_text(text, chunk_size=400, chunk_overlap=50)
        # Overlap is prepended, so allow headroom; the point is that no chunk
        # grows without bound.
        for c in chunks:
            assert len(c.text) <= 400 + 50 + 100

    def test_overlap_carries_context_forward(self):
        text = "\n\n".join(f"Unique sentence number {i} appears here." for i in range(40))
        with_overlap = chunk_text(text, chunk_size=300, chunk_overlap=100)
        without = chunk_text(text, chunk_size=300, chunk_overlap=0)
        # Overlap duplicates content, so total length is larger.
        assert sum(len(c.text) for c in with_overlap) > sum(len(c.text) for c in without)

    def test_heading_is_attached_to_following_chunks(self):
        text = "Eligibility Criteria\n\n" + "The applicant must be registered. " * 30
        chunks = chunk_text(text, chunk_size=300, chunk_overlap=40)
        assert any(c.heading == "Eligibility Criteria" for c in chunks)

    def test_token_estimate_is_positive(self):
        for c in chunk_text("Some text to chunk here.", chunk_size=900):
            assert c.token_estimate >= 1


class TestSchemeRecordToText:
    def test_renders_present_fields_only(self):
        text = scheme_record_to_text(
            {
                "name": "Test Scheme",
                "provider": "Test Provider",
                "ministry": None,
                "supportedIndustries": ["Technology", "Manufacturing"],
                "eligibilityCriteria": [],
                "description": "A description.",
            }
        )
        assert "Scheme: Test Scheme" in text
        assert "Provider: Test Provider" in text
        assert "Technology, Manufacturing" in text
        # Absent and empty fields are omitted, not rendered as "None" or blank,
        # which would otherwise be embedded as if it were content.
        assert "Ministry" not in text
        assert "Eligibility criteria" not in text
        assert "None" not in text

    def test_handles_an_empty_record(self):
        assert scheme_record_to_text({}) == ""


class TestHeadingVsProseRegression:
    """
    Regression: a wrapped body line must not be mistaken for a section heading.

    Found by running a real generated PDF through the pipeline. The Executive
    Summary wrapped onto a line beginning "management. We are seeking Rs
    50,00,000 to expand across Maharashtra. We currently" — exactly 12 words,
    which passed the old heading test and then matched the one-word "management"
    pattern for the Team section. The spurious Team section stole the following
    line, and team scored 25 on a proposal with a complete team section.
    """

    WRAPPED_EXEC_SUMMARY = (
        "Executive Summary\n"
        "BuildTech Solutions provides an IoT and mobile platform for construction equipment\n"
        "management. We are seeking Rs 50,00,000 to expand across Maharashtra. We currently\n"
        "serve 14 paying customers with annual revenue of Rs 35,00,000.\n"
        "\n"
        "Our Team\n"
        "Rahul Sharma, co-founder, 7 years in construction project management. Priya Mehta,\n"
        "co-founder, 9 years building industrial IoT systems. Eight engineers and two sales staff.\n"
    )

    def test_wrapped_body_line_does_not_open_a_section(self):
        sections = detect_sections(self.WRAPPED_EXEC_SUMMARY)
        # The real Team heading is what defines the team section.
        assert "team" in sections
        assert "Rahul Sharma" in sections["team"]
        assert "co-founder" in sections["team"]

    def test_executive_summary_keeps_its_whole_body(self):
        sections = detect_sections(self.WRAPPED_EXEC_SUMMARY)
        assert "executive_summary" in sections
        # All three wrapped lines belong to it.
        assert "management." in sections["executive_summary"]
        assert "serve 14 paying customers" in sections["executive_summary"]

    def test_a_long_prose_line_is_never_a_heading(self):
        prose = (
            "Market Opportunity\n"
            "Revenue grew steadily. The team expanded. Customers increased every quarter.\n"
        )
        sections = detect_sections(prose)
        # "Revenue" and "team" patterns must not fire on a prose line.
        assert "financials" not in sections
        assert "team" not in sections

    def test_numbered_headings_still_work(self):
        sections = detect_sections("1. Executive Summary\n\nWe build things.\n\n2. Our Team\n\nTwo founders.\n")
        assert "executive_summary" in sections
        assert "team" in sections

    def test_a_heading_with_a_few_extra_words_still_matches(self):
        sections = detect_sections("Use of Funds Breakdown\n\nRs 10,00,000 for hiring staff.\n")
        assert "use_of_funds" in sections
