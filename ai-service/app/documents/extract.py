"""
PDF and DOCX text extraction.

Both formats are parsed as untrusted input. The parsers are used in text-only
mode: no embedded scripts, no external entity resolution, no following of links
inside the document.
"""

from __future__ import annotations

import io
import logging

from ..nlp.cleaning import clean_text, detect_sections, looks_scanned, missing_sections, word_count
from ..schemas import ExtractResponse

logger = logging.getLogger(__name__)

#: Magic bytes. Checked here as well as in the Node backend — defence in depth,
#: because this service may later be called by something else.
PDF_MAGIC = b"%PDF-"
#: DOCX is a ZIP container.
ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")

MAX_PAGES = 300


class ExtractionError(ValueError):
    """The file could not be parsed as the declared type."""


def sniff_kind(data: bytes) -> str | None:
    """Returns 'pdf', 'docx' or None based on content, not on the filename."""
    if data.startswith(PDF_MAGIC):
        return "pdf"
    if any(data.startswith(m) for m in ZIP_MAGIC):
        return "docx"
    return None


def _extract_pdf(data: bytes) -> tuple[str, int, list[str]]:
    # Imported as `pymupdf`, not the deprecated `fitz` alias.
    import pymupdf

    warnings: list[str] = []
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            if doc.is_encrypted:
                # An encrypted PDF that needs a password cannot be read; say so
                # rather than returning an empty analysis.
                raise ExtractionError(
                    "This PDF is password protected. Remove the protection and upload again."
                )

            page_count = doc.page_count
            if page_count > MAX_PAGES:
                warnings.append(
                    f"Document has {page_count} pages; only the first {MAX_PAGES} were read."
                )

            parts: list[str] = []
            for index, page in enumerate(doc):
                if index >= MAX_PAGES:
                    break
                # "text" mode returns plain text only — never embedded
                # JavaScript, form actions or annotations.
                parts.append(page.get_text("text"))

        return "\n".join(parts), page_count, warnings
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError(f"The PDF could not be read: {exc}") from exc


def _extract_docx(data: bytes) -> tuple[str, int | None, list[str]]:
    import docx

    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:
        raise ExtractionError(f"The Word document could not be read: {exc}") from exc

    parts: list[str] = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        # A heading style is a strong structural signal that would be lost in
        # flat text, so it is preserved on its own line for section detection.
        style = (paragraph.style.name or "").lower() if paragraph.style else ""
        if style.startswith("heading") or style == "title":
            parts.append(f"\n{text}\n")
        else:
            parts.append(text)

    # Tables frequently hold the financials in a real proposal, so dropping them
    # would systematically understate the financial score.
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))

    return "\n".join(parts), None, []


def extract_document(data: bytes, declared_kind: str | None = None) -> ExtractResponse:
    """
    Extracts, cleans and segments a document.

    The content sniff takes precedence over any declared type: a file renamed
    from .exe to .pdf must not be handed to the PDF parser on the strength of its
    extension.
    """
    if not data:
        raise ExtractionError("The file is empty.")

    kind = sniff_kind(data)
    if kind is None:
        raise ExtractionError(
            "Only PDF and Word (.docx) files are supported, and this file is neither."
        )
    if declared_kind and declared_kind != kind:
        logger.warning("declared kind %s but content is %s", declared_kind, kind)

    if kind == "pdf":
        raw, page_count, warnings = _extract_pdf(data)
    else:
        raw, page_count, warnings = _extract_docx(data)

    text = clean_text(raw)
    sections = detect_sections(text)
    detected = list(sections.keys())
    scanned = looks_scanned(text, page_count)

    if scanned:
        warnings.append(
            "Very little text could be extracted. If this is a scanned document, "
            "upload a text-based version — analysis of an image-only file is not reliable."
        )

    return ExtractResponse(
        text=text,
        word_count=word_count(text),
        page_count=page_count,
        # Excerpts only: the full body is already in `text`, and repeating it per
        # section would multiply the payload size.
        sections={k: v[:2000] for k, v in sections.items()},
        detected_sections=detected,
        missing_sections=missing_sections(detected),
        likely_scanned=scanned,
        warnings=warnings,
    )
