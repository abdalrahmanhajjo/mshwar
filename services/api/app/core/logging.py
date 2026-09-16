"""Process-wide logging setup. Never log secrets, tokens or full email addresses."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

_STANDARD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update({key: value for key, value in record.__dict__.items() if key not in _STANDARD_ATTRS})
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str, log_format: str) -> None:
    handler = logging.StreamHandler()
    if log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger("mshwar")
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    root.propagate = False
