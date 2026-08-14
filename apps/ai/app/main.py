"""Uvicorn entry point for the Python AI service."""

import uvicorn

from app.adapters.inbound.http.app import create_app
from app.config import get_settings

app = create_app()


def run() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.env == "development",
        log_config=None,
        log_level=settings.log_level,
    )


if __name__ == "__main__":
    run()
