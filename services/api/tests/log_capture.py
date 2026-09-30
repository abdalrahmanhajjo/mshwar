"""Collect log records from one logger in a test (works with or without pytest's caplog)."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager


class _Collector(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)


@contextmanager
def captured(logger_name: str) -> Iterator[list[logging.LogRecord]]:
    logger = logging.getLogger(logger_name)
    collector = _Collector()
    previous = logger.level
    logger.addHandler(collector)
    logger.setLevel(logging.DEBUG)
    try:
        yield collector.records
    finally:
        logger.removeHandler(collector)
        logger.setLevel(previous)
