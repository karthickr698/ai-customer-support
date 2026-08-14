from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class FetchedWebDocument:
    url: str
    body: bytes
    media_type: str
    final_url: str


class UrlFetchPort(Protocol):
    """Fetches public HTTP(S) documents for URL ingestion."""

    async def fetch(self, url: str, tenant_id: str) -> FetchedWebDocument: ...
