"""URL safety rules for document ingestion. No network I/O lives here."""

from ipaddress import ip_address, ip_network
from urllib.parse import urlparse

from app.domain.errors import UnsafeUrlError

_BLOCKED_NETWORKS = tuple(
    ip_network(value)
    for value in (
        "0.0.0.0/8",
        "10.0.0.0/8",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
    )
)
_BLOCKED_HOSTS = frozenset(
    {
        "localhost",
        "metadata.google.internal",
        "metadata.google.internal.",
    }
)


def assert_safe_http_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeUrlError("URL must start with http or https")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("URLs with credentials cannot be fetched")
    host = parsed.hostname.lower().rstrip(".")
    if host in _BLOCKED_HOSTS or host.endswith(".local"):
        raise UnsafeUrlError()
    try:
        address = ip_address(host)
    except ValueError:
        return url.strip()
    _assert_public_ip(address)
    return url.strip()


def assert_public_resolved_ip(value: str) -> None:
    _assert_public_ip(ip_address(value))


def _assert_public_ip(address: object) -> None:
    ip = ip_address(str(address))
    if any(ip in network for network in _BLOCKED_NETWORKS) or ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        raise UnsafeUrlError()
