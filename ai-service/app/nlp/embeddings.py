"""
Sentence embeddings.

The model is loaded lazily and once. Loading all-MiniLM-L6-v2 takes a few
seconds and around 90MB, so doing it at import time would make the service slow
to start and would make `pytest` pay the cost even for tests that never embed
anything.
"""

from __future__ import annotations

import logging
import threading

import numpy as np

from ..config import get_settings

logger = logging.getLogger(__name__)

_model = None
#: Guards model construction. Without it, two concurrent first requests would
#: each load a copy of the model into memory.
_model_lock = threading.Lock()


class EmbeddingsUnavailable(RuntimeError):
    """Raised when embeddings are disabled or the model could not be loaded."""


def _load_model():  # noqa: ANN202 - SentenceTransformer type needs the import
    global _model
    settings = get_settings()

    if not settings.enable_embeddings:
        raise EmbeddingsUnavailable("embeddings are disabled by configuration")

    if _model is not None:
        return _model

    with _model_lock:
        # Re-checked inside the lock: another thread may have loaded it while
        # this one waited.
        if _model is not None:
            return _model
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("loading embedding model %s", settings.embedding_model)
            model = SentenceTransformer(settings.embedding_model)

            actual_dim = int(model.get_sentence_embedding_dimension())
            if actual_dim != settings.embedding_dim:
                # A mismatch would silently corrupt the stored index: vectors of
                # one width compared against queries of another.
                raise EmbeddingsUnavailable(
                    f"model produces {actual_dim}-dimension vectors but "
                    f"FB_AI_EMBEDDING_DIM is {settings.embedding_dim}; stored "
                    "embeddings would be unusable"
                )

            _model = model
            return _model
        except EmbeddingsUnavailable:
            raise
        except Exception as exc:  # pragma: no cover - environment dependent
            raise EmbeddingsUnavailable(f"could not load embedding model: {exc}") from exc


def is_available() -> bool:
    """Cheap check that does not force a model load."""
    return get_settings().enable_embeddings


def model_name() -> str:
    return get_settings().embedding_model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embeds texts, returning L2-normalised vectors.

    Normalising here means cosine similarity reduces to a dot product both in
    this service and in the backend's SQL retrieval, so the two cannot disagree
    about what a similarity score means.
    """
    model = _load_model()
    vectors = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [v.astype(float).tolist() for v in np.atleast_2d(vectors)]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


def cosine_similarity(query: str, candidates: list[str]) -> list[float]:
    """
    Similarity of one query against many candidates, mapped to [0,1].

    Raw cosine over normalised vectors lies in [-1,1]. It is rescaled here
    rather than at each call site, because a negative factor score would be
    meaningless in the weighted matching sum.
    """
    vectors = embed_texts([query] + candidates)
    q = np.array(vectors[0])
    matrix = np.array(vectors[1:])

    raw = matrix @ q  # already normalised, so this is cosine
    rescaled = (raw + 1.0) / 2.0
    return [float(min(1.0, max(0.0, s))) for s in rescaled]
