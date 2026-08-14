from app.domain.errors import UnsafeUrlError
from app.domain.url_safety import assert_safe_http_url


def test_rejects_localhost_and_private_hosts() -> None:
    try:
        assert_safe_http_url("http://localhost/help")
        raise AssertionError("expected UnsafeUrlError")
    except UnsafeUrlError:
        pass
    try:
        assert_safe_http_url("http://127.0.0.1/help")
        raise AssertionError("expected UnsafeUrlError")
    except UnsafeUrlError:
        pass
    try:
        assert_safe_http_url("http://169.254.169.254/latest")
        raise AssertionError("expected UnsafeUrlError")
    except UnsafeUrlError:
        pass


def test_accepts_public_https_url() -> None:
    assert assert_safe_http_url("https://example.com/help") == "https://example.com/help"
