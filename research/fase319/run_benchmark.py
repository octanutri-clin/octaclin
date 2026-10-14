"""Run the frozen synthetic retrieval experiment; model files stay outside Git."""
from __future__ import annotations

import hashlib
import json
import math
import os
import resource
import statistics
import time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from tokenizers import Tokenizer

from benchmark import bm25, chunk_token_ids, ndcg, recall

ROOT = Path(__file__).parent
MODELS = Path("/tmp/f319-models")
PROTOCOL = json.loads((ROOT / "protocolo.json").read_text())
CORPUS_BYTES = (ROOT / "corpus.json").read_bytes()
CORPUS = json.loads(CORPUS_BYTES)
assert hashlib.sha256(CORPUS_BYTES).hexdigest() == PROTOCOL["corpusSha256"]


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def inspect_graph(path: Path) -> dict:
    graph = onnx.load(str(path), load_external_data=False)
    onnx.checker.check_model(graph)
    domains = sorted({node.domain for node in graph.graph.node if node.domain not in ("", "ai.onnx")})
    if domains:
        raise RuntimeError(f"Unexpected custom ONNX domains: {domains}")
    metadata = {p.key: p.value for p in graph.metadata_props}
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"],
        sess_options=ort.SessionOptions())
    return {"sha256": sha(path), "bytes": path.stat().st_size,
            "opset": [(x.domain, x.version) for x in graph.opset_import],
            "customDomains": domains, "metadata": metadata,
            "inputs": [(i.name, i.type, i.shape) for i in session.get_inputs()],
            "outputs": [(o.name, o.type, o.shape) for o in session.get_outputs()]}


class Embedder:
    def __init__(self, model_path: Path, tokenizer_path: Path, prefix: str, max_len: int):
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        self.session = ort.InferenceSession(str(model_path), sess_options=opts, providers=["CPUExecutionProvider"])
        self.tokenizer = Tokenizer.from_file(str(tokenizer_path))
        self.prefix = prefix
        self.max_len = max_len

    def _encode_id_batches(self, id_batches: list[list[int]], batch_size: int = 16) -> np.ndarray:
        vectors = []
        for start in range(0, len(id_batches), batch_size):
            rows = id_batches[start:start + batch_size]
            max_batch = max(len(row) for row in rows)
            input_ids = np.zeros((len(rows), max_batch), dtype=np.int64)
            attn = np.zeros_like(input_ids)
            type_ids = np.zeros_like(input_ids)
            for i, ids in enumerate(rows):
                input_ids[i, :len(ids)] = ids
                attn[i, :len(ids)] = 1
                # Both pinned BERT-family exports use a single sentence segment.
                type_ids[i, :len(ids)] = 0
            supplied = {"input_ids": input_ids, "attention_mask": attn, "token_type_ids": type_ids}
            inputs = {inp.name: supplied[inp.name] for inp in self.session.get_inputs() if inp.name in supplied}
            outputs = self.session.run(None, inputs)
            hidden = outputs[0]
            if hidden.ndim == 3:
                mask = attn[:, :, None].astype(hidden.dtype)
                hidden = (hidden * mask).sum(axis=1) / np.maximum(mask.sum(axis=1), 1.0)
            if hidden.ndim != 2:
                raise RuntimeError(f"Unexpected output shape {hidden.shape}")
            norm = np.linalg.norm(hidden, axis=1, keepdims=True)
            vectors.append(hidden / np.maximum(norm, 1e-12))
        return np.concatenate(vectors, axis=0) if vectors else np.empty((0, 384), dtype=np.float32)

    def _add_special_tokens(self, ids: list[int], sample_text: str) -> list[int]:
        plain = self.tokenizer.encode(sample_text, add_special_tokens=False).ids
        full = self.tokenizer.encode(sample_text, add_special_tokens=True).ids
        if not plain:
            return full
        # Locate content token IDs in the wrapped encoding; the surrounding IDs
        # are the tokenizer's own CLS/SEP tokens, not hard-coded vocabulary IDs.
        for start in range(len(full) - len(plain) + 1):
            if full[start:start + len(plain)] == plain:
                return full[:start] + ids + full[start + len(plain):]
        raise RuntimeError("Unable to identify tokenizer special-token wrapper")

    def encode(self, texts: list[str], batch_size: int = 16) -> np.ndarray:
        rows = []
        for text in texts:
            raw = self.tokenizer.encode(self.prefix + text, add_special_tokens=False).ids
            wrapped = [self._add_special_tokens(chunk, self.prefix + text)
                       for chunk in chunk_token_ids(raw, 96, 24)]
            rows.append(wrapped)
        flat = [chunk for chunks in rows for chunk in chunks]
        chunk_vectors = self._encode_id_batches(flat, batch_size)
        result, pos = [], 0
        for chunks in rows:
            vectors = chunk_vectors[pos:pos + len(chunks)]
            pos += len(chunks)
            result.append(vectors)
        return result


def metrics_for(runs: dict[str, dict[str, list[str]]], queries: list[dict]) -> dict:
    answerable = [q for q in queries if q["answerable"]]
    output = {}
    for name, hits_by_id in runs.items():
        rows = []
        for q in queries:
            hits = hits_by_id[q["id"]]
            rows.append({"queryId": q["id"], "category": q["category"], "answerable": q["answerable"],
                         "ndcg10": ndcg(q["gold"], hits, 10), "recall10": recall(q["gold"], hits, 10),
                         "top10": hits})
        pos = [r for r in rows if r["answerable"]]
        output[name] = {"ndcg10Mean": statistics.mean(r["ndcg10"] for r in pos),
                        "recall10Mean": statistics.mean(r["recall10"] for r in pos),
                        "rows": rows,
                        "noAnswerReturnedAny": sum(bool(hits_by_id[q["id"]]) for q in queries if not q["answerable"])}
    return output


def main() -> None:
    # Static graph inspection before ONNX Runtime loads the model for inference.
    specs = {
        "e5": (MODELS / "e5.onnx", MODELS / "e5-tokenizer.json", "passage: ", "query: ", 512),
        "miniLM": (MODELS / "minilm.onnx", MODELS / "minilm-tokenizer.json", "", "", 128),
    }
    graph_reports = {name: inspect_graph(spec[0]) for name, spec in specs.items()}
    docs = [d for d in CORPUS["documents"] if d["tenant"] == "tenant-sim-1" and d["patient"] == "patient-sim-1"]
    queries = [q for q in CORPUS["queries"] if q["partition"] == "test"]
    bm_runs = {}
    for q in queries:
        bm_runs[q["id"]] = [x[0] for x in bm25(q["query"], docs, k=10)]
    all_runs = {"bm25": bm_runs}
    latency = {}
    build = {}
    for name, (model, tokenizer, doc_prefix, query_prefix, max_len) in specs.items():
        embedder = Embedder(model, tokenizer, doc_prefix, max_len)
        start = time.perf_counter()
        doc_chunks = embedder.encode([d["text"] for d in docs])
        build[name] = {"seconds": time.perf_counter() - start, "sources": len(docs),
                       "chunks": sum(len(x) for x in doc_chunks)}
        start = time.perf_counter()
        q_vecs = np.vstack([chunks[0] for chunks in embedder.encode([q["query"] for q in queries], batch_size=1)])
        query_seconds = time.perf_counter() - start
        model_runs = {}
        for qi, q in enumerate(queries):
            source_scores = []
            for di, chunks in enumerate(doc_chunks):
                score = max(float(q_vecs[qi] @ vector) for vector in chunks)
                source_scores.append((di, score))
            order = sorted(source_scores, key=lambda item: (-item[1], docs[item[0]]["id"]))[:10]
            model_runs[q["id"]] = [docs[j]["id"] for j, _ in order]
        all_runs[name] = model_runs
        # Warm-query p95 from replaying all frozen test queries without re-encoding the corpus.
        samples = []
        for q in queries:
            start = time.perf_counter()
            qv = embedder.encode([q["query"]], batch_size=1)[0][0]
            _ = [max(float(qv @ vector) for vector in chunks) for chunks in doc_chunks]
            samples.append(time.perf_counter() - start)
        latency[name] = {"warmP95Seconds": float(np.percentile(samples, 95)),
                         "queryEncodingBatchSeconds": query_seconds}
    report = {
        "protocolVersion": PROTOCOL["versao"], "corpusSha256": hashlib.sha256(CORPUS_BYTES).hexdigest(),
        "testQueries": len(queries), "eligibleSourceCount": len(docs),
        "machine": {"cpuCount": os.cpu_count(), "python": os.sys.version,
                    "maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},
        "models": graph_reports, "build": build, "latency": latency,
        "results": metrics_for(all_runs, queries),
        "limitations": ["synthetic authored corpus only", "gold source IDs constructed, not independently human reviewed",
                        "no human task-time trial", "no product tenant/RLS/authz integration", "license rights not legally verified"]
    }
    out = ROOT / "results" / "run-001.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ["testQueries", "eligibleSourceCount", "machine", "build", "latency", "limitations"]}, ensure_ascii=False, indent=2))
    for name, result in report["results"].items():
        print(name, "NDCG@10", result["ndcg10Mean"], "Recall@10", result["recall10Mean"],
              "no-answer top10 nonempty", result["noAnswerReturnedAny"])


if __name__ == "__main__":
    main()
