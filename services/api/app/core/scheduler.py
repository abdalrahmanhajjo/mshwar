"""The internal scheduler: calls the API's job endpoints on a timetable.

It runs as its own small container next to the API (see docker-compose.staging.yml)
and talks to it over the compose network with the internal job token, the same way
any cron would. Keeping it outside the API process means a restart of either one
never double-runs or drops a job, and every job stays an ordinary, logged HTTP call.

Jobs are safe to repeat: the partner sweep dedupes its warnings, and dispatch only
sends what is still pending. So the sweep also runs once at start-up, which covers a
box that was down at the scheduled hour.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import time as clock
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger("mshwar.scheduler")

BEIRUT = ZoneInfo("Asia/Beirut")
RETRY_AFTER = timedelta(minutes=5)


@dataclass(frozen=True)
class Job:
    name: str
    path: str
    every: timedelta | None = None
    daily_at: time | None = None
    run_at_start: bool = False

    def next_after(self, now: datetime) -> datetime:
        """The next time this job is due, strictly after `now` (an aware datetime)."""
        if self.every is not None:
            return now + self.every
        if self.daily_at is None:
            raise ValueError(f"job {self.name} has no schedule")
        local = now.astimezone(BEIRUT)
        due = datetime.combine(local.date(), self.daily_at, tzinfo=BEIRUT)
        if due <= local:
            due = datetime.combine(local.date() + timedelta(days=1), self.daily_at, tzinfo=BEIRUT)
        return due


JOBS: dict[str, Job] = {
    # Expiry warnings (30 and 7 days), lapses, stale transport cards and venue checks.
    "sweep": Job("sweep", "/api/v1/partners/ops/sweep", daily_at=time(3, 0), run_at_start=True),
    # Sends queued email and in-app notifications, including the sweep's warnings.
    "dispatch": Job("dispatch", "/api/v1/notifications/dispatch", every=timedelta(minutes=1)),
}


@dataclass(frozen=True)
class SchedulerConfig:
    api_url: str
    token: str
    jobs: tuple[Job, ...]
    heartbeat: Path | None

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> SchedulerConfig:
        env = dict(os.environ if env is None else env)
        token = env.get("INTERNAL_JOB_TOKEN") or env.get("NOTIFICATION_DISPATCH_TOKEN") or ""
        if len(token) < 32:
            raise ValueError(
                "the scheduler needs INTERNAL_JOB_TOKEN (at least 32 characters), the same one the API uses"
            )
        names = [name.strip() for name in env.get("SCHEDULER_JOBS", "sweep,dispatch").split(",") if name.strip()]
        unknown = [name for name in names if name not in JOBS]
        if unknown:
            raise ValueError(f"unknown scheduler jobs: {', '.join(unknown)} (known: {', '.join(JOBS)})")
        if not names:
            raise ValueError("SCHEDULER_JOBS is empty")
        heartbeat = env.get("SCHEDULER_HEARTBEAT", "/tmp/mshwar-scheduler-heartbeat")  # noqa: S108 - liveness file only
        return cls(
            api_url=env.get("SCHEDULER_API_URL", "http://api:8000").rstrip("/"),
            token=token,
            jobs=tuple(JOBS[name] for name in names),
            heartbeat=Path(heartbeat) if heartbeat else None,
        )


Caller = Callable[[Job], Awaitable[bool]]


def http_caller(config: SchedulerConfig, client: httpx.AsyncClient) -> Caller:
    async def call(job: Job) -> bool:
        started = clock.monotonic()
        try:
            response = await client.post(f"{config.api_url}{job.path}", headers={"X-Job-Token": config.token})
        except httpx.HTTPError as exc:
            logger.warning(json.dumps({"job": job.name, "ok": False, "error": type(exc).__name__}))
            return False
        ok = response.status_code < 400
        record: dict[str, object] = {
            "job": job.name,
            "ok": ok,
            "status": response.status_code,
            "ms": round((clock.monotonic() - started) * 1000),
        }
        if ok and job.name == "sweep":
            with contextlib.suppress(ValueError):
                record["result"] = response.json()
        (logger.info if ok else logger.warning)(json.dumps(record, default=str))
        return ok

    return call


def first_runs(jobs: tuple[Job, ...], now: datetime) -> dict[str, datetime]:
    return {job.name: now if job.run_at_start else job.next_after(now) for job in jobs}


def after_run(job: Job, ok: bool, now: datetime) -> datetime:
    """When to run a job again: on schedule after success, soon after a failure."""
    if ok:
        return job.next_after(now)
    retry = now + RETRY_AFTER
    return min(retry, job.next_after(now)) if job.every is not None else retry


async def run_forever(
    config: SchedulerConfig,
    call: Caller,
    *,
    now: Callable[[], datetime] = lambda: datetime.now(tz=BEIRUT),
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    max_ticks: int | None = None,
) -> None:
    due = first_runs(config.jobs, now())
    jobs = {job.name: job for job in config.jobs}
    ticks = 0
    logger.info(json.dumps({"scheduler": "started", "jobs": sorted(jobs), "api": config.api_url}))
    while max_ticks is None or ticks < max_ticks:
        ticks += 1
        name = min(due, key=lambda key: due[key])
        wait = (due[name] - now()).total_seconds()
        if wait > 0:
            # Wake at least every minute so the heartbeat stays fresh.
            await sleep(min(wait, 60.0))
            beat(config.heartbeat)
            continue
        ok = await call(jobs[name])
        due[name] = after_run(jobs[name], ok, now())
        beat(config.heartbeat)


def beat(path: Path | None) -> None:
    if path is not None:
        try:
            path.write_text(str(int(clock.time())))
        except OSError:
            logger.warning(json.dumps({"scheduler": "heartbeat_failed", "path": str(path)}))


def heartbeat_is_fresh(path: Path, max_age_seconds: int = 180) -> bool:
    try:
        return clock.time() - int(path.read_text().strip()) <= max_age_seconds
    except (OSError, ValueError):
        return False


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    config = SchedulerConfig.from_env()
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        await run_forever(config, http_caller(config, client))
