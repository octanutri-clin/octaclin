"""Offline, deterministic retrieval metrics and lexical baseline for Phase 319."""
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from typing import Iterable

TOKEN_RE = re.compile(r"[\w]+", re.UNICODE)
STOP = {"a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "o", "os", "para", "por", "que", "um", "uma"}


def chunk_token_ids(ids: list[int], size: int = 96, overlap: int = 24) -> list[list[int]]:
    if size < 1 or overlap < 0 or overlap >= size:
        raise ValueError("Invalid chunk size/overlap")
    if not ids:
        return [[]]
    stride = size - overlap
    return [ids[start:start + size] for start in range(0, len(ids), stride)]


def tokenize(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", unicodedata.normalize("NFKC", text).casefold())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return [t for t in TOKEN_RE.findall(normalized) if t not in STOP]


def bm25(query: str, documents: list[dict], k: int = 10, k1: float = 1.2, b: float = 0.75) -> list[tuple[str, float]]:
    """BM25 over one already-authorized patient's source list."""
    if not documents or k < 1:
        return []
    token_docs = [tokenize(d["text"]) for d in documents]
    avgdl = sum(map(len, token_docs)) / len(token_docs) or 1.0
    df = Counter(token for tokens in token_docs for token in set(tokens))
    qterms = set(tokenize(query))
    scored = []
    n = len(documents)
    for doc, tokens in zip(documents, token_docs):
        tf = Counter(tokens)
        score = 0.0
        for term in qterms:
            if not tf[term]:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            denom = tf[term] + k1 * (1 - b + b * len(tokens) / avgdl)
            score += idf * tf[term] * (k1 + 1) / denom
        scored.append((doc["id"], score))
    scored.sort(key=lambda pair: (-pair[1], pair[0]))
    return scored[:k]


def ndcg(gold: list[dict], hits: Iterable[str], k: int = 10) -> float | None:
    """NDCG with graded gain (2**grade - 1); None means no answer expected."""
    grades = {item["sourceId"]: item["grade"] for item in gold}
    if not grades:
        return None
    ranked = list(hits)[:k]
    dcg = sum((2 ** grades.get(doc_id, 0) - 1) / math.log2(i + 2) for i, doc_id in enumerate(ranked))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** grade - 1) / math.log2(i + 2) for i, grade in enumerate(ideal))
    return dcg / idcg if idcg else 0.0


def recall(gold: list[dict], hits: Iterable[str], k: int = 10) -> float | None:
    if not gold:
        return None
    relevant = {item["sourceId"] for item in gold}
    return len(relevant.intersection(list(hits)[:k])) / len(relevant)
