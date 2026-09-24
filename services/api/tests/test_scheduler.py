"""The internal scheduler: timetable, retries, token and a real call against the app."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from pathlib import Path

import httpx
import pytest

from app.core.scheduler import (
    BEIRUT,
    JOBS,
    RETRY_AFTER,
    Job,
    SchedulerConfig,
    after_run,
    beat,
    first_runs,
    heartbeat_is_fresh,
    http_caller,
    run_forever,
)

TOKEN = "t" * 40


def test_daily_job_runs_at_three_in_beirut_whatever_the_server_clock() -> None:
    sweep = JOBS["sweep"]
    before = datetime(2026, 9, 24, 1, 30, tzinfo=BEIRUT)
    assert sweep.next_after(before) == datetime(2026, 9, 24, 3, 0, tzinfo=BEIRUT)
    after = datetime(2026, 9, 24, 3, 0, tzinfo=BEIRUT)
    assert sweep.next_after(after) == datetime(2026, 9, 25, 3, 0, tzinfo=BEIRUT)
    # A UTC clock at 23:30 is already 02:30 the next day in Beirut (UTC+3 in summer).
    utc = datetime.fromisoformat("2026-09-24T23:30:00+00:00")
    assert sweep.next_after(utc) == datetime(2026, 9, 25, 3, 0, tzinfo=BEIRUT)


def test_interval_job_and_a_job_without_a_schedule() -> None:
    now = datetime(2026, 9, 24, 12, 0, tzinfo=BEIRUT)
    assert JOBS["dispatch"].next_after(now) == now + timedelta(minutes=1)
    with pytest.raises(ValueError):
        Job("broken", "/x").next_after(now)


def test_sweep_runs_at_start_and_failures_retry_soon() -> None:
    now = datetime(2026, 9, 24, 12, 0, tzinfo=BEIRUT)
    due = first_runs((JOBS["sweep"], JOBS["dispatch"]), now)
    assert due["sweep"] == now
    assert due["dispatch"] == now + timedelta(minutes=1)
    assert after_run(JOBS["sweep"], False, now) == now + RETRY_AFTER
    assert after_run(JOBS["sweep"], True, now) == datetime(2026, 9, 25, 3, 0, tzinfo=BEIRUT)
    # A failing minute job keeps its minute, it does not wait five.
    assert after_run(JOBS["dispatch"], False, now) == now + timedelta(minutes=1)


def test_config_needs_the_job_token_and_known_jobs() -> None:
    with pytest.raises(ValueError, match="INTERNAL_JOB_TOKEN"):
        SchedulerConfig.from_env({"INTERNAL_JOB_TOKEN": "short"})
    with pytest.raises(ValueError, match="unknown scheduler jobs: nope"):
        SchedulerConfig.from_env({"INTERNAL_JOB_TOKEN": TOKEN, "SCHEDULER_JOBS": "sweep,nope"})
    with pytest.raises(ValueError, match="empty"):
        SchedulerConfig.from_env({"INTERNAL_JOB_TOKEN": TOKEN, "SCHEDULER_JOBS": " , "})
    config = SchedulerConfig.from_env(
        {"NOTIFICATION_DISPATCH_TOKEN": TOKEN, "SCHEDULER_API_URL": "http://api:8000/", "SCHEDULER_JOBS": "sweep"}
    )
    assert config.api_url == "http://api:8000"
    assert [job.name for job in config.jobs] == ["sweep"]
    assert SchedulerConfig.from_env({"INTERNAL_JOB_TOKEN": TOKEN, "SCHEDULER_HEARTBEAT": ""}).heartbeat is None


async def test_the_loop_runs_due_jobs_and_sleeps_until_the_next() -> None:
    clock = {"now": datetime(2026, 9, 24, 12, 0, tzinfo=BEIRUT)}
    calls: list[str] = []
    slept: list[float] = []

    async def call(job: Job) -> bool:
        calls.append(job.name)
        return True

    async def sleep(seconds: float) -> None:
        slept.append(seconds)
        clock["now"] += timedelta(seconds=seconds)

    config = SchedulerConfig("http://api", TOKEN, (JOBS["sweep"], JOBS["dispatch"]), None)
    await run_forever(config, call, now=lambda: clock["now"], sleep=sleep, max_ticks=5)
    assert calls == ["sweep", "dispatch", "dispatch"]
    assert slept == [60.0, 60.0]


def test_heartbeat(tmp_path: Path) -> None:
    path = tmp_path / "beat"
    assert heartbeat_is_fresh(path) is False
    beat(path)
    assert heartbeat_is_fresh(path) is True
    path.write_text("0")
    assert heartbeat_is_fresh(path) is False
    beat(None)
    beat(tmp_path / "missing" / "beat")  # an unwritable path is logged, not raised


async def test_calls_the_real_endpoints_with_the_job_token(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "internal_job_token", TOKEN)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://api") as client:
        config = SchedulerConfig("http://api", TOKEN, (JOBS["sweep"],), None)
        assert await http_caller(config, client)(JOBS["sweep"]) is True
        wrong = SchedulerConfig("http://api", "w" * 40, (JOBS["sweep"],), None)
        assert await http_caller(wrong, client)(JOBS["sweep"]) is False


async def test_an_unreachable_api_is_a_failed_run_not_a_crash() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(refuse)) as client:
        config = SchedulerConfig("http://api", TOKEN, (JOBS["dispatch"],), None)
        assert await http_caller(config, client)(JOBS["dispatch"]) is False


def test_the_sweep_is_scheduled_daily_at_three() -> None:
    assert JOBS["sweep"].daily_at == time(3, 0)
