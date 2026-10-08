"""Images API client with a mocked urlopen (no network, no real key)."""

from __future__ import annotations

import base64
import io
import json
import logging
import socket
import urllib.error

import pytest
from PIL import Image

from bigviz import provider
from bigviz.log import read_sidecar, write_sidecar
from bigviz.provider import Config, ImageClient, ProviderError, encode_multipart, timeout_for

FAKE_KEY = "sk-test-not-a-real-key"


def png_bytes(w: int, h: int) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 20, 30)).save(buf, "PNG")
    return buf.getvalue()


class FakeResponse:
    def __init__(self, body: bytes):
        self.body = body

    def read(self, n: int = -1) -> bytes:
        return self.body if n < 0 else self.body[:n]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def http_error(code: int, headers: dict | None = None) -> urllib.error.HTTPError:
    body = io.BytesIO(json.dumps({"error": {"message": f"boom {code}"}}).encode())
    return urllib.error.HTTPError("https://x/images", code, "err", headers or {}, body)


class Recorder:
    """Plays back a script of responses/exceptions and records every request."""

    def __init__(self, script):
        self.script = list(script)
        self.requests = []

    def __call__(self, req, timeout=None):
        self.requests.append((req, timeout))
        item = self.script.pop(0)
        if isinstance(item, BaseException):
            raise item
        return FakeResponse(item)


def ok_body(w=1024, h=1024, n=1) -> bytes:
    b64 = base64.b64encode(png_bytes(w, h)).decode()
    return json.dumps({"data": [{"b64_json": b64}] * n}).encode()


@pytest.fixture
def client():
    sleeps = []
    c = ImageClient(Config(FAKE_KEY, "https://api.example.test/v1", "gpt-image-1"),
                    retries=3, backoff=0.5, sleep=sleeps.append)
    c.sleeps = sleeps
    return c


def test_generate_json_payload(monkeypatch, client):
    rec = Recorder([ok_body(1536, 1024)])
    monkeypatch.setattr(provider, "urlopen", rec)
    res = client.generate("hello", size="1536x1024", quality="high")
    req, timeout = rec.requests[0]
    assert req.full_url == "https://api.example.test/v1/images/generations"
    assert req.get_header("Authorization") == f"Bearer {FAKE_KEY}"
    payload = json.loads(req.data)
    assert payload == {"model": "gpt-image-1", "prompt": "hello", "n": 1, "size": "1536x1024", "quality": "high"}
    assert res[0].size == "1536x1024" and not res[0].mismatch
    assert timeout == pytest.approx(timeout_for("1536x1024", 1, "high"))
    assert timeout_for("2048x1152") > timeout_for("1024x1024") > timeout_for("1024x1024", quality="low")


def test_retry_on_429_and_5xx_then_success(monkeypatch, client):
    rec = Recorder([http_error(429, {"Retry-After": "3"}), http_error(503), socket.timeout("slow"),
                    ok_body()])
    monkeypatch.setattr(provider, "urlopen", rec)
    res = client.generate("x", size="1024x1024")
    assert len(rec.requests) == 4 and len(res) == 1
    assert client.sleeps[0] == 3.0  # Retry-After honoured
    assert 1.0 <= client.sleeps[1] <= 1.25  # backoff * 2**1 + jitter
    assert 2.0 <= client.sleeps[2] <= 2.5


def test_no_retry_on_400_and_give_up(monkeypatch, client):
    monkeypatch.setattr(provider, "urlopen", Recorder([http_error(400)]))
    with pytest.raises(ProviderError, match="HTTP 400.*boom 400"):
        client.generate("x")
    rec = Recorder([http_error(500)] * 4)
    monkeypatch.setattr(provider, "urlopen", rec)
    with pytest.raises(ProviderError, match="giving up after 4 attempts"):
        client.generate("x")
    assert len(rec.requests) == 4


def test_dns_failure_fails_fast_and_404_download_not_retried(monkeypatch, client):
    rec = Recorder([urllib.error.URLError(socket.gaierror("no such host"))])
    monkeypatch.setattr(provider, "urlopen", rec)
    with pytest.raises(ProviderError, match="cannot reach"):
        client.generate("x")
    assert len(rec.requests) == 1 and not client.sleeps
    rec = Recorder([http_error(404)])
    monkeypatch.setattr(provider, "urlopen", rec)
    with pytest.raises(ProviderError, match="HTTP 404"):
        client._download("https://cdn.example.test/a.png")
    assert len(rec.requests) == 1


def test_download_rejects_non_http_and_oversized(monkeypatch, client):
    with pytest.raises(ProviderError, match="non-http"):
        client._download("file:///etc/passwd")
    monkeypatch.setattr(provider, "MAX_RESPONSE_BYTES", 10)
    monkeypatch.setattr(provider, "urlopen", Recorder([b"x" * 50]))
    with pytest.raises(ProviderError, match="larger than"):
        client._download("https://cdn.example.test/a.png")


def test_redirect_drops_auth_on_cross_host():
    handler = provider._NoAuthLeakRedirect()
    req = provider.urllib.request.Request("https://api.example.test/v1/x",
                                          headers={"Authorization": "Bearer k"})
    same = handler.redirect_request(req, None, 307, "", {}, "https://api.example.test/v1/y")
    other = handler.redirect_request(req, None, 307, "", {}, "https://evil.example.org/y")
    assert same.get_header("Authorization") == "Bearer k"
    assert other.get_header("Authorization") is None
    assert FAKE_KEY not in repr(Config(FAKE_KEY))


def test_edit_multipart_body(monkeypatch, client, tmp_path):
    a, b = tmp_path / "a.png", tmp_path / "b.png"
    a.write_bytes(png_bytes(8, 8))
    b.write_bytes(png_bytes(4, 4))
    rec = Recorder([ok_body()])
    monkeypatch.setattr(provider, "urlopen", rec)
    client.edit("make it sharper", [a, b], size="1024x1024", quality="high")
    req, _ = rec.requests[0]
    assert req.full_url.endswith("/images/edits")
    ctype = req.get_header("Content-type")
    assert ctype.startswith("multipart/form-data; boundary=")
    boundary = ctype.split("boundary=")[1].encode()
    body = req.data
    assert body.count(b'name="image[]"') == 2
    assert b'filename="a.png"' in body and b'filename="b.png"' in body
    assert b"Content-Type: image/png" in body
    assert b'name="prompt"\r\n\r\nmake it sharper\r\n' in body
    assert b'name="size"\r\n\r\n1024x1024\r\n' in body
    assert body.endswith(b"--" + boundary + b"--\r\n")
    assert png_bytes(8, 8) in body


def test_size_mismatch_warning(monkeypatch, client, caplog):
    monkeypatch.setattr(provider, "urlopen", Recorder([ok_body(1672, 941)]))
    with caplog.at_level(logging.WARNING, logger="bigviz.provider"):
        res = client.generate("x", size="2048x1152")
    assert res[0].mismatch and res[0].size == "1672x941"
    assert "size mismatch: requested 2048x1152, got 1672x941" in caplog.text
    assert FAKE_KEY not in caplog.text


def test_url_fallback(monkeypatch, client):
    body = json.dumps({"data": [{"url": "https://cdn.example.test/img.png"}]}).encode()
    rec = Recorder([body, png_bytes(64, 32)])
    monkeypatch.setattr(provider, "urlopen", rec)
    res = client.generate("x")
    assert res[0].size == "64x32"
    assert rec.requests[1][0].full_url == "https://cdn.example.test/img.png"
    assert rec.requests[1][0].get_header("Authorization") is None  # key never sent to the CDN


def test_missing_key_and_env(monkeypatch):
    monkeypatch.delenv("BIGVIZ_API_KEY", raising=False)
    monkeypatch.setenv("BIGVIZ_BASE_URL", "https://proxy.test/v1/")
    cfg = Config.from_env()
    assert cfg.api_key is None and cfg.base_url == "https://proxy.test/v1" and cfg.model == "gpt-image-1"
    with pytest.raises(ProviderError, match="BIGVIZ_API_KEY"):
        ImageClient(cfg).generate("x")
    assert "response_format" in ImageClient(cfg)._common("x", "dall-e-3", None, None, 1)


def test_multipart_and_sidecar(tmp_path):
    body, ctype = encode_multipart({"a": "1"}, [])
    assert ctype.split("boundary=")[1] in body.decode()
    img = tmp_path / "d.png"
    img.write_bytes(png_bytes(2, 2))
    write_sidecar(img, prompt_file="p.txt", prompt_text="hi", model="m", size_requested="1024x1024",
                  size_actual="1672x941", quality="high", refs=["r.png"])
    rec = read_sidecar(img)
    assert rec["size_mismatch"] is True and rec["prompt_hash"].startswith("sha256:")
    assert rec["refs"] == ["r.png"] and rec["prompt_file"] == "p.txt" and "timestamp" in rec
