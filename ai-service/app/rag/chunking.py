"""
Chunking for retrieval.

Chunks are split on paragraph boundaries wherever possible, because a chunk that
ends mid-sentence embeds poorly and reads badly when shown as a citation. Each
chunk carries the nearest preceding heading so a citation can point somewhere a
human can actually find in the source document.
"""

from __future__ import annotations

import re

from ..schemas import Chunk

#: Rough characters-per-token for English. Only used for reporting, never for a
#: hard limit, so an approximation is adequate.
CHARS_PER_TOKEN = 4


def _looks_like_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 90:
        return False
    if stripped.endswith("."):
        return False
    words = stripped.split()
    if len(words) > 12:
        return False
    # Numbered, title case, or all caps.
    return bool(
        re.match(r"^\d+[\.\)]", stripped)
        or stripped.isupper()
        or sum(1 for w in words if w[:1].isupper()) >= max(1, len(words) // 2)
    )


def _split_long_paragraph(paragraph: str, limit: int) -> list[str]:
    """
    Splits an over-long paragraph on sentence boundaries.

    Falls back to a hard character split only if a single sentence exceeds the
    limit, which happens with tables flattened into prose.
    """
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    parts: list[str] = []
    current = ""

    for sentence in sentences:
        if len(sentence) > limit:
            if current:
                parts.append(current.strip())
                current = ""
            for i in range(0, len(sentence), limit):
                parts.append(sentence[i : i + limit].strip())
            continue

        if len(current) + len(sentence) + 1 > limit:
            if current:
                parts.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip()

    if current:
        parts.append(current.strip())
    return [p for p in parts if p]


def chunk_text(text: str, *, chunk_size: int = 900, chunk_overlap: int = 150) -> list[Chunk]:
    """
    Splits text into overlapping chunks.

    Overlap means a fact sitting on a boundary appears whole in at least one
    chunk, which is what stops retrieval from missing it.
    """
    if not text or not text.strip():
        return []

    lines = text.split("\n")
    # (heading, paragraph) pairs, so heading context survives the split.
    blocks: list[tuple[str | None, str]] = []
    heading: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            body = "\n".join(buffer).strip()
            if body:
                blocks.append((heading, body))
            buffer.clear()

    for line in lines:
        if _looks_like_heading(line):
            flush()
            heading = line.strip()
        elif not line.strip():
            flush()
        else:
            buffer.append(line)
    flush()

    if not blocks:
        blocks = [(None, text.strip())]

    chunks: list[Chunk] = []
    current_text = ""
    current_heading: str | None = None

    def emit(body: str, head: str | None) -> None:
        body = body.strip()
        if not body:
            return
        chunks.append(
            Chunk(
                index=len(chunks),
                text=body,
                heading=head,
                token_estimate=max(1, len(body) // CHARS_PER_TOKEN),
            )
        )

    for block_heading, body in blocks:
        for piece in (
            [body] if len(body) <= chunk_size else _split_long_paragraph(body, chunk_size)
        ):
            if not current_text:
                current_text, current_heading = piece, block_heading
                continue

            if len(current_text) + len(piece) + 2 <= chunk_size:
                current_text = f"{current_text}\n\n{piece}"
                continue

            emit(current_text, current_heading)

            # Carry the tail of the previous chunk forward as overlap.
            tail = current_text[-chunk_overlap:] if chunk_overlap else ""
            if tail:
                # Start the overlap at a word boundary so the chunk does not
                # begin mid-word.
                space = tail.find(" ")
                if space > 0:
                    tail = tail[space + 1 :]
                current_text = f"{tail}\n\n{piece}" if tail else piece
            else:
                current_text = piece
            current_heading = block_heading

    emit(current_text, current_heading)
    return chunks


def scheme_record_to_text(record: dict) -> str:
    """
    Renders a curated scheme record as prose for indexing.

    The structured record is the authoritative source for matching; this text
    exists so a scheme with no attached PDF is still retrievable. Only fields
    actually present are included — an absent field is omitted rather than
    rendered as "None", which would otherwise be embedded as if it were content.
    """
    parts: list[str] = []

    def add(label: str, value: object) -> None:
        if value is None:
            return
        if isinstance(value, (list, tuple)):
            items = [str(v) for v in value if v]
            if items:
                parts.append(f"{label}: {', '.join(items)}")
            return
        text = str(value).strip()
        if text:
            parts.append(f"{label}: {text}")

    add("Scheme", record.get("name"))
    add("Provider", record.get("provider"))
    add("Ministry", record.get("ministry"))
    add("Department", record.get("department"))
    add("Level", record.get("level"))
    add("Scheme type", record.get("schemeType"))
    add("Description", record.get("description"))
    add("Funding", record.get("fundingDescription"))
    add("Supported industries", record.get("supportedIndustries"))
    add("Supported business stages", record.get("supportedStages"))
    add("Supported locations", record.get("supportedLocations"))
    add("Supported purposes", record.get("supportedPurposes"))
    add("Eligibility criteria", record.get("eligibilityCriteria"))
    add("Required documents", record.get("requiredDocuments"))
    add("Application process", record.get("applicationProcess"))

    return "\n\n".join(parts)
