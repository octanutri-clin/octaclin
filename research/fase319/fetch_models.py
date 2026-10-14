"""Download pinned research artifacts with a bounded, allowlisted HTTP flow."""
from __future__ import annotations

import hashlib
import pathlib
from urllib.parse import urljoin, urlsplit

import requests

OUT = pathlib.Path("/tmp/f319-models")
ALLOWED_HOSTS = frozenset({"huggingface.co", "us.aws.cdn.hf.co"})
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
MAX_REDIRECTS = 4
CHUNK_SIZE = 1024 * 1024
FILES = [
    ("e5.onnx", "https://huggingface.co/intfloat/multilingual-e5-small/resolve/614241f622f53c4eeff9890bdc4f31cfecc418b3/onnx/model.onnx", "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665", 470268510),
    ("e5-tokenizer.json", "https://huggingface.co/intfloat/multilingual-e5-small/resolve/614241f622f53c4eeff9890bdc4f31cfecc418b3/tokenizer.json", "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39", 17082730),
    ("minilm.onnx", "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/onnx/model.onnx", "10f7a088420252b26caf819236ca2c9d2987afd0fc06fec7553b542a5655a05a", 470301610),
    ("minilm-tokenizer.json", "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/e8f8c211226b894fcb81acc59f3b34ba3efd5f42/tokenizer.json", "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8", 9081518),
]


def validate_download_url(url: str) -> None:
    """Accept only HTTPS URLs to the pinned Hugging Face delivery hosts."""
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Invalid artifact URL") from exc

    if (
        parsed.scheme != "https"
        or parsed.hostname is None
        or parsed.hostname.lower() not in ALLOWED_HOSTS
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
        or parsed.fragment
    ):
        raise ValueError("Artifact URL is outside the approved HTTPS host boundary")


def download_file(
    session: requests.Session,
    url: str,
    path: pathlib.Path,
    *,
    expected_size: int,
    expected_hash: str,
) -> None:
    """Fetch one exact-size artifact, checking every redirect before following it."""
    current_url = url
    temporary_path = path.with_name(f"{path.name}.part")
    digest = hashlib.sha256()
    size = 0

    try:
        for redirect_count in range(MAX_REDIRECTS + 1):
            validate_download_url(current_url)
            response = session.get(
                current_url,
                headers={"User-Agent": "OctaClin-Phase319-synthetic-research/1.0"},
                timeout=90,
                stream=True,
                allow_redirects=False,
            )
            if response.status_code in REDIRECT_STATUSES:
                location = response.headers.get("Location")
                response.close()
                if not location or redirect_count == MAX_REDIRECTS:
                    raise ValueError("Artifact redirect is missing or exceeds the redirect limit")
                current_url = urljoin(current_url, location)
                # Validate before making a request to the redirect destination.
                validate_download_url(current_url)
                continue

            try:
                if response.status_code != 200:
                    raise ValueError(f"Artifact server returned HTTP {response.status_code}")
                with temporary_path.open("wb") as target:
                    for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                        if not chunk:
                            continue
                        if size + len(chunk) > expected_size:
                            raise ValueError("Artifact exceeds its declared size")
                        target.write(chunk)
                        digest.update(chunk)
                        size += len(chunk)
            finally:
                response.close()
            break
        else:  # pragma: no cover - loop exits through an explicit redirect guard
            raise ValueError("Artifact redirect limit exceeded")

        actual_hash = digest.hexdigest()
        if size != expected_size or actual_hash != expected_hash:
            raise ValueError("Artifact integrity check failed; expected size/hash mismatch")
        temporary_path.replace(path)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with requests.Session() as session:
        for name, url, expected_hash, expected_size in FILES:
            path = OUT / name
            download_file(
                session,
                url,
                path,
                expected_size=expected_size,
                expected_hash=expected_hash,
            )
            print(f"PASS {name} bytes={expected_size} sha256={expected_hash}")


if __name__ == "__main__":
    main()
