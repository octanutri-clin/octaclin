"""Network-boundary tests for the offline research artifact downloader."""
from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

from fetch_models import download_file, validate_download_url


class FakeResponse:
    def __init__(self, status_code: int, *, headers=None, chunks=()):
        self.status_code = status_code
        self.headers = headers or {}
        self._chunks = chunks
        self.closed = False

    def iter_content(self, chunk_size: int):
        yield from self._chunks

    def close(self):
        self.closed = True


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.responses.pop(0)


class FetchModelsSecurityTests(unittest.TestCase):
    def test_initial_and_redirect_urls_require_approved_https_hosts(self):
        for url in (
            "file:///etc/passwd",
            "http://huggingface.co/model",
            "https://127.0.0.1/model",
            "https://huggingface.co.evil.invalid/model",
            "https://user@huggingface.co/model",
            "https://huggingface.co:444/model",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_download_url(url)

    def test_pinned_huggingface_redirect_downloads_only_from_observed_cdn(self):
        payload = b"synthetic-model-bytes"
        session = FakeSession([
            FakeResponse(302, headers={"Location": "https://us.aws.cdn.hf.co/model"}),
            FakeResponse(200, chunks=[payload]),
        ])
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "model.onnx"
            download_file(
                session,
                "https://huggingface.co/model/resolve/commit/model.onnx",
                target,
                expected_size=len(payload),
                expected_hash=hashlib.sha256(payload).hexdigest(),
            )
            self.assertEqual(target.read_bytes(), payload)
        self.assertEqual([call[0] for call in session.calls], [
            "https://huggingface.co/model/resolve/commit/model.onnx",
            "https://us.aws.cdn.hf.co/model",
        ])
        self.assertTrue(all(call[1]["allow_redirects"] is False for call in session.calls))

    def test_private_redirect_is_rejected_before_requesting_destination(self):
        session = FakeSession([
            FakeResponse(302, headers={"Location": "http://127.0.0.1:8080/metadata"}),
        ])
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "model.onnx"
            with self.assertRaises(ValueError):
                download_file(
                    session,
                    "https://huggingface.co/model/resolve/commit/model.onnx",
                    target,
                    expected_size=10,
                    expected_hash="0" * 64,
                )
            self.assertFalse(target.exists())
        self.assertEqual(len(session.calls), 1)

    def test_redirect_to_an_unobserved_external_host_is_rejected(self):
        session = FakeSession([
            FakeResponse(302, headers={"Location": "https://attacker.invalid/payload"}),
        ])
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "model.onnx"
            with self.assertRaises(ValueError):
                download_file(
                    session,
                    "https://huggingface.co/model/resolve/commit/model.onnx",
                    target,
                    expected_size=10,
                    expected_hash="0" * 64,
                )
            self.assertFalse(target.exists())
        self.assertEqual(len(session.calls), 1)

    def test_oversized_body_stops_at_declared_size_and_leaves_no_file(self):
        session = FakeSession([FakeResponse(200, chunks=[b"1234", b"5678"])])
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "model.onnx"
            with self.assertRaises(ValueError):
                download_file(
                    session,
                    "https://huggingface.co/model/resolve/commit/model.onnx",
                    target,
                    expected_size=5,
                    expected_hash="0" * 64,
                )
            self.assertFalse(target.exists())
            self.assertEqual(list(Path(temp_dir).iterdir()), [])

    def test_hash_mismatch_does_not_replace_or_leave_partial_artifact(self):
        session = FakeSession([FakeResponse(200, chunks=[b"synthetic-bytes"])])
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "model.onnx"
            with self.assertRaises(ValueError):
                download_file(
                    session,
                    "https://huggingface.co/model/resolve/commit/model.onnx",
                    target,
                    expected_size=len(b"synthetic-bytes"),
                    expected_hash="0" * 64,
                )
            self.assertFalse(target.exists())
            self.assertEqual(list(Path(temp_dir).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
