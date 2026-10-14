"""Single-model scale probe on deterministic synthetic documents, CPU only."""
from __future__ import annotations

import hashlib
import json
import resource
import time
from pathlib import Path

import numpy as np

from benchmark import bm25
from run_benchmark import CORPUS, Embedder, MODELS

ROOT = Path(__file__).parent
SIZES = [50, 51, 200, 1000, 5000]
FILLER = [
    "Revisou opções variadas para refeições em casa e horários da semana.",
    "Comentou sobre lista de compras, preparo e organização do almoço.",
    "Foi registrada conversa sobre rotina, preferências e refeições do fim de semana.",
    "A pessoa mencionou frutas, bebidas e escolhas feitas durante o expediente.",
    "Anotação sintética sobre horários e alimentos comentados em conversa fictícia.",
    "A evolução descreve preferências gerais sem registrar recomendação ou conduta.",
    "Relatou atividades da semana e planejamento de refeições em família.",
    "Registro de teste fala de ingredientes, mercado local e preparo de receitas.",
]


def main() -> None:
    base = sorted((d for d in CORPUS["documents"] if d["tenant"] == "tenant-sim-1" and d["patient"] == "patient-sim-1"),
                  key=lambda d: (d["created"], d["id"]))
    docs = list(base)
    while len(docs) < max(SIZES):
        i = len(docs)
        txt = f"{FILLER[i % len(FILLER)]} Referência sintética {i:05}."
        if i == max(SIZES) - 1:
            txt = ("Nota sintética longa para verificar divisão em janelas sem truncamento. " * 80)[:6000]
        docs.append({"id": f"scale-{i:05}", "tenant": "tenant-sim-1", "patient": "patient-sim-1", "text": txt})

    model_start = time.perf_counter()
    embedder = Embedder(MODELS / "e5.onnx", MODELS / "e5-tokenizer.json", "passage: ", 512)
    model_load_seconds = time.perf_counter() - model_start
    qlist = [q["query"] for q in CORPUS["queries"] if q["partition"] == "test"]
    rows = []
    all_vectors = []
    done = 0
    start_all = time.perf_counter()
    for size in SIZES:
        start = time.perf_counter()
        new = embedder.encode([d["text"] for d in docs[done:size]])
        all_vectors.extend(x[0] if len(x) == 1 else x for x in new)
        build_seconds = time.perf_counter() - start
        done = size
        selected_queries = list(range(len(qlist)))
        latencies = []
        query_hits = []
        for qi in selected_queries:
            start = time.perf_counter()
            qv = embedder.encode([qlist[qi]], batch_size=1)[0][0]
            scores = [max(float(qv @ vec) for vec in (v if isinstance(v, np.ndarray) and v.ndim == 2 else [v]))
                      for v in all_vectors[:size]]
            latencies.append(time.perf_counter() - start)
            query_hits.append(int(np.argmax(scores)))
        bm_start = time.perf_counter()
        _ = bm25(qlist[0], docs[:size], k=10)
        bm_seconds = time.perf_counter() - bm_start
        rows.append({"sources": size, "buildSegmentSeconds": build_seconds,
                     "cumulativeBuildSeconds": sum(r["buildSegmentSeconds"] for r in rows) + build_seconds,
                     "embeddingChunks": sum(len(x) if isinstance(x, np.ndarray) and x.ndim == 2 else 1 for x in all_vectors),
                     "queryCount": len(selected_queries),
                     "warmP95Seconds": float(np.percentile(latencies, 95)),
                     "bm25OneQuerySeconds": bm_seconds,
                     "returnedIndexesSample": query_hits[:5]})
    report = {"protocolVersion": 3,
              "corpusSha256": hashlib.sha256((ROOT / "corpus.json").read_bytes()).hexdigest(),
              "model": "multilingual-e5-small", "modelSha256": hashlib.sha256((MODELS / "e5.onnx").read_bytes()).hexdigest(),
              "syntheticOnly": True, "cpuOnly": True, "sizes": rows,
              "modelLoadSeconds": model_load_seconds,
              "maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              "totalSeconds": time.perf_counter() - start_all,
              "limitations": ["generated short fillers except one 6000-character chunking fixture",
                              "timing from one local container, not deployment infrastructure", "no PHI"]}
    out = ROOT / "results" / "scale-e5.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
