"""OpenAI-compatible Images API client, stdlib only.

- `POST {base}/images/generations` (JSON) and `POST {base}/images/edits`
  (multipart, one `image[]` part per reference image).
- `b64_json` is decoded; a `url` response is downloaded instead.
- 429 / 5xx / timeouts are retried with exponential backoff.
- The real size of every returned image is read and compared with the
  request: some proxies ignore `size` (e.g. return ~1672x941).
- Configuration via BIGVIZ_API_KEY / BIGVIZ_BASE_URL / BIGVIZ_MODEL.
  The key is only ever put in the Authorization header, never logged.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import mimetypes
import os
import random
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

log = logging.getLogger("bigviz.provider")

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-image-1"
RETRY_STATUS = {408, 429, 500, 502, 503, 504}
MAX_RESPONSE_BYTES = 64 * 1024 * 1024  # hard cap on any response body
DOWNLOAD_SCHEMES = {"https", "http"}


class _NoAuthLeakRedirect(urllib.request.HTTPRedirectHandler):
    """Follow redirects, but never forward the Authorization header to another host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and urllib.parse.urlsplit(newurl).netloc != urllib.parse.urlsplit(req.full_url).netloc:
            new.headers.pop("Authorization", None)
            new.unredirected_hdrs.pop("Authorization", None)
        return new


urlopen = urllib.request.build_opener(_NoAuthLeakRedirect).open  # module attribute so tests can patch it


def _read_capped(resp, limit: int | None = None) -> bytes:
    limit = MAX_RESPONSE_BYTES if limit is None else limit
    data = resp.read(limit + 1)
    if len(data) > limit:
        raise ProviderError(f"response larger than {limit // (1024 * 1024)} MB, refusing")
    return data


class ProviderError(RuntimeError):
    """API call failed (after retries) or returned something unusable."""


@dataclass
class ImageResult:
    data: bytes
    width: int
    height: int
    requested: str | None = None
    revised_prompt: str | None = None

    @property
    def size(self) -> str:
        return f"{self.width}x{self.height}"

    @property
    def mismatch(self) -> bool:
        return bool(self.requested) and self.requested != "auto" and self.requested != self.size


@dataclass
class Config:
    api_key: str | None = field(default=None, repr=False)
    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            api_key=os.environ.get("BIGVIZ_API_KEY") or None,
            base_url=(os.environ.get("BIGVIZ_BASE_URL") or DEFAULT_BASE_URL).rstrip("/"),
            model=os.environ.get("BIGVIZ_MODEL") or DEFAULT_MODEL,
        )


def parse_size(size: str | None) -> tuple[int, int] | None:
    if not size or size == "auto":
        return None
    try:
        w, h = size.lower().split("x")
        return int(w), int(h)
    except ValueError as exc:
        raise ValueError(f"size must look like 1536x1024 or 'auto', got '{size}'") from exc


def timeout_for(size: str | None, n: int = 1, quality: str | None = None) -> float:
    """Request timeout that scales with requested pixels (1 MP high ~= 180 s)."""
    wh = parse_size(size) or (1536, 1024)
    mp = wh[0] * wh[1] / 1e6
    q = {"low": 0.4, "medium": 0.7}.get(quality or "high", 1.0)
    return max(60.0, 90.0 + 150.0 * mp * max(1, n) * q)


def encode_multipart(fields: dict[str, str], files: list[tuple[str, Path]]) -> tuple[bytes, str]:
    """Hand-built multipart/form-data body; returns (body, content-type)."""
    boundary = f"----bigviz{uuid.uuid4().hex}"
    buf = io.BytesIO()
    for name, value in fields.items():
        buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n".encode())
        buf.write(str(value).encode("utf-8") + b"\r\n")
    for name, path in files:
        path = Path(path)
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        buf.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
                  f"filename=\"{path.name}\"\r\nContent-Type: {ctype}\r\n\r\n".encode())
        buf.write(path.read_bytes() + b"\r\n")
    buf.write(f"--{boundary}--\r\n".encode())
    return buf.getvalue(), f"multipart/form-data; boundary={boundary}"


@dataclass
class ImageClient:
    """Minimal Images API client. `retries` = extra attempts after the first one."""

    config: Config = field(default_factory=Config.from_env)
    retries: int = 4
    backoff: float = 2.0
    max_backoff: float = 60.0
    sleep: object = time.sleep  # injectable for tests

    def _require_key(self) -> str:
        if not self.config.api_key:
            raise ProviderError("BIGVIZ_API_KEY is not set")
        return self.config.api_key

    def _post(self, path: str, body: bytes, ctype: str, timeout: float) -> dict:
        url = f"{self.config.base_url}{path}"
        headers = {"Authorization": f"Bearer {self._require_key()}", "Content-Type": ctype,
                   "Accept": "application/json", "User-Agent": "bigviz-cli"}
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            try:
                with urlopen(req, timeout=timeout) as resp:
                    return json.loads(_read_capped(resp).decode("utf-8"))
            except urllib.error.HTTPError as exc:
                detail = _error_detail(exc)
                if exc.code not in RETRY_STATUS:
                    raise ProviderError(f"HTTP {exc.code} from {path}: {detail}") from None
                last = ProviderError(f"HTTP {exc.code} from {path}: {detail}")
                wait = _retry_after(exc)
            except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
                reason = getattr(exc, "reason", exc)
                if isinstance(exc, urllib.error.URLError) and not _is_transient(reason):
                    raise ProviderError(f"cannot reach {self.config.base_url}: {reason}") from None
                last = ProviderError(f"network error on {path}: {reason}")
                wait = None
            except json.JSONDecodeError as exc:
                raise ProviderError(f"non-JSON response from {path}: {exc}") from None
            if attempt == self.retries:
                break
            delay = wait if wait is not None else min(self.max_backoff, self.backoff * 2 ** attempt)
            delay += random.uniform(0, 0.25 * delay) if wait is None else 0
            log.warning("%s; retry %d/%d in %.1fs", last, attempt + 1, self.retries, delay)
            self.sleep(delay)
        raise ProviderError(f"giving up after {self.retries + 1} attempts: {last}")

    def _common(self, prompt: str, model: str | None, size: str | None, quality: str | None,
                n: int) -> dict:
        model = model or self.config.model
        payload = {"model": model, "prompt": prompt, "n": n}
        if size:
            parse_size(size)
            payload["size"] = size
        if quality:
            payload["quality"] = quality
        # gpt-image-* always return b64 and reject response_format; dall-e needs it
        if not model.startswith("gpt-image"):
            payload["response_format"] = "b64_json"
        return payload

    def generate(self, prompt: str, *, model: str | None = None, size: str | None = None,
                 quality: str | None = None, n: int = 1) -> list[ImageResult]:
        payload = self._common(prompt, model, size, quality, n)
        body = json.dumps(payload).encode("utf-8")
        data = self._post("/images/generations", body, "application/json", timeout_for(size, n, quality))
        return self._decode(data, size)

    def edit(self, prompt: str, images: list[Path | str], *, model: str | None = None,
             size: str | None = None, quality: str | None = None, n: int = 1) -> list[ImageResult]:
        if not images:
            raise ProviderError("edit needs at least one --image")
        payload = self._common(prompt, model, size, quality, n)
        fields = {k: str(v) for k, v in payload.items()}
        files = [("image[]", Path(p)) for p in images]
        body, ctype = encode_multipart(fields, files)
        data = self._post("/images/edits", body, ctype, timeout_for(size, n, quality) * 1.3)
        return self._decode(data, size)

    def _decode(self, data: dict, requested: str | None) -> list[ImageResult]:
        items = data.get("data") or []
        if not items:
            raise ProviderError(f"response has no images: {str(data)[:300]}")
        out = []
        for item in items:
            if item.get("b64_json"):
                raw = base64.b64decode(item["b64_json"])
            elif item.get("url"):
                raw = self._download(item["url"])
            else:
                raise ProviderError("image item has neither b64_json nor url")
            try:
                with Image.open(io.BytesIO(raw)) as im:
                    w, h = im.size
            except Exception as exc:  # noqa: BLE001 - any decode failure is a provider error
                raise ProviderError(f"returned data is not an image: {exc}") from None
            res = ImageResult(raw, w, h, requested, item.get("revised_prompt"))
            if res.mismatch:
                log.warning("size mismatch: requested %s, got %s (the endpoint may ignore `size`; "
                            "run `bigviz probe`)", requested, res.size)
            out.append(res)
        return out

    def _download(self, url: str) -> bytes:
        if urllib.parse.urlsplit(url).scheme.lower() not in DOWNLOAD_SCHEMES:
            raise ProviderError(f"refusing to download image from non-http(s) url: {url[:80]}")
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with urlopen(urllib.request.Request(url, headers={"User-Agent": "bigviz-cli"}),
                             timeout=120) as resp:
                    return _read_capped(resp)
            except urllib.error.HTTPError as exc:
                if exc.code not in RETRY_STATUS:
                    raise ProviderError(f"image download failed: HTTP {exc.code}") from None
                last = exc
            except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as exc:
                if isinstance(exc, urllib.error.URLError) and not _is_transient(exc.reason):
                    raise ProviderError(f"image download failed: {exc.reason}") from None
                last = exc
            if attempt < self.retries:
                self.sleep(min(self.max_backoff, self.backoff * 2 ** attempt))
        raise ProviderError(f"image download failed: {last}")


def _error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        return exc.reason or ""
    try:
        msg = json.loads(body).get("error", {})
        return (msg.get("message") if isinstance(msg, dict) else str(msg)) or body[:300]
    except (ValueError, AttributeError):
        return body[:300]


def _retry_after(exc: urllib.error.HTTPError) -> float | None:
    value = exc.headers.get("Retry-After") if exc.headers else None
    try:
        return min(120.0, float(value)) if value else None
    except ValueError:
        return None


def _is_transient(reason: object) -> bool:
    # DNS failures, TLS errors and refused connections are configuration problems: fail fast
    return isinstance(reason, (socket.timeout, TimeoutError, ConnectionResetError, ConnectionAbortedError))
