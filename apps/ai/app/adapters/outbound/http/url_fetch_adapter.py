import logging
import socket
from urllib.parse import urlparse

import httpx

from app.application.ports.url_fetch_port import FetchedWebDocument, UrlFetchPort
from app.domain.errors import AIProviderError, DocumentParseError, UnsafeUrlError
from app.domain.ingestion import MAX_BINARY_BYTES
from app.domain.url_safety import assert_public_resolved_ip, assert_safe_http_url

_TIMEOUT_SECONDS = 20.0
_MAX_REDIRECTS = 3


class HttpUrlFetchAdapter(UrlFetchPort):
    def __init__(self, logger: logging.Logger, client: httpx.AsyncClient | None = None) -> None:
        self._logger = logger
        self._client = client

    async def fetch(self, url: str, tenant_id: str) -> FetchedWebDocument:
        current = assert_safe_http_url(url)
        _assert_resolved_public(current)
        client = self._client or httpx.AsyncClient(
            timeout=_TIMEOUT_SECONDS,
            follow_redirects=False,
            max_redirects=0,
        )
        owns_client = self._client is None
        try:
            for _ in range(_MAX_REDIRECTS + 1):
                try:
                    response = await client.get(current, headers={"User-Agent": "ai-customer-support-ingestion/1.0"})
                except httpx.TimeoutException as exc:
                    raise AIProviderError("The URL timed out") from exc
                except httpx.HTTPError as exc:
                    raise AIProviderError("The URL could not be fetched") from exc

                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise UnsafeUrlError("Redirect was missing a location")
                    current = assert_safe_http_url(str(response.url.join(location)))
                    _assert_resolved_public(current)
                    continue

                if response.status_code >= 400:
                    self._logger.warning(
                        "URL fetch returned an error",
                        extra={"tenantId": tenant_id, "statusCode": response.status_code},
                    )
                    raise DocumentParseError("The URL could not be downloaded")

                body = response.content
                if len(body) > MAX_BINARY_BYTES:
                    raise DocumentParseError("The downloaded document is too large")

                media_type = (response.headers.get("content-type") or "text/html").split(";")[0].strip().lower()
                return FetchedWebDocument(
                    url=url,
                    body=body,
                    media_type=media_type or "text/html",
                    final_url=str(response.url),
                )

            raise UnsafeUrlError("Too many redirects")
        finally:
            if owns_client:
                await client.aclose()


def _assert_resolved_public(url: str) -> None:
    hostname = urlparse(url).hostname
    if not hostname:
        raise UnsafeUrlError()
    try:
        infos = socket.getaddrinfo(hostname, None)
    except OSError as exc:
        raise UnsafeUrlError("The URL host could not be resolved") from exc
    addresses = {info[4][0] for info in infos if info[4]}
    if not addresses:
        raise UnsafeUrlError("The URL host could not be resolved")
    for address in addresses:
        assert_public_resolved_ip(str(address))
