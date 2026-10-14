"""Download only pinned ONNX/tokenizer artifacts and verify their declared LFS hashes."""
from __future__ import annotations

import hashlib
import pathlib
import urllib.request

OUT = pathlib.Path("/tmp/f319-models")
FILES = [
    ("e5.onnx", "https://huggingface.co/intfloat/multilingual-e5-small/resolve/614241f622f53c4eeff9890bdc4f31cfecc418b3/onnx/model.onnx", "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665", 470268510),
    ("e5-tokenizer.json", "https://huggingface.co/intfloat/multilingual-e5-small/resolve/614241f622f53c4eeff9890bdc4f31cfecc418b3/tokenizer.json", "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39", 17082730),
    ("minilm.onnx", "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/onnx/model.onnx", "10f7a088420252b26caf819236ca2c9d2987afd0fc06fec7553b542a5655a05a", 470301610),
    ("minilm-tokenizer.json", "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/tokenizer.json", "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8", 9081518),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, url, expected_hash, expected_size in FILES:
        path = OUT / name
        digest = hashlib.sha256()
        size = 0
        request = urllib.request.Request(url, headers={"User-Agent": "OctaClin-Phase319-synthetic-research/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response, path.open("wb") as target:
            while chunk := response.read(1024 * 1024):
                target.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        actual = digest.hexdigest()
        if size != expected_size or actual != expected_hash:
            path.unlink(missing_ok=True)
            raise SystemExit(f"Integrity check failed for {name}; expected size/hash mismatch")
        print(f"PASS {name} bytes={size} sha256={actual}")


if __name__ == "__main__":
    main()
