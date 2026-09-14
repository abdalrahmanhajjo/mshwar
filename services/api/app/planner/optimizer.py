from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.planner.geo_math import duration_seconds, road_distance_m
from app.planner.routing import RouteLeg, RoutingCost, RoutingService

INF = 10**12


@dataclass
class OptimizeStop:
    id: str
    lat: float
    lng: float
    label: str = "Stop"
    duration_minutes: int = 60
    locked: bool = False
    position: int | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    closes_at: datetime | None = None
    weather_sensitivity: str = "outdoor"
    estimated_minor: int = 0


@dataclass
class SolveStop:
    id: str
    label: str
    lat: float
    lng: float
    position: int
    locked: bool
    arrives_at: datetime | None
    departs_at: datetime | None
    duration_minutes: int
    weather_sensitivity: str
    estimated_minor: int


@dataclass
class OptimizeResult:
    feasible: bool
    reason: str | None
    solver: str
    fallback: bool
    timeout: bool
    ordered: list[SolveStop]
    legs: list[RouteLeg]
    total_distance_m: int | None
    total_duration_seconds: int | None
    metrics_available: bool
    routing_cost: RoutingCost
    solve_ms: float
    window_start: datetime
    return_by: datetime


def _seconds_since(origin: datetime, moment: datetime | None, default: int) -> int:
    if moment is None:
        return default
    aware = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    base = origin if origin.tzinfo else origin.replace(tzinfo=timezone.utc)
    return int((aware - base).total_seconds())


def _haversine_matrix(coords: list[tuple[float, float]], mode: str) -> list[list[int]]:
    grid: list[list[int]] = []
    for i, (olat, olng) in enumerate(coords):
        row: list[int] = []
        for j, (dlat, dlng) in enumerate(coords):
            if i == j:
                row.append(0)
            else:
                row.append(duration_seconds(road_distance_m(olat, olng, dlat, dlng), mode))
        grid.append(row)
    return grid


def _held_karp(
    travel: list[list[int]],
    stay: list[int],
    windows: list[tuple[int, int]],
    closes: list[int],
    locked_at: dict[int, int],
    return_limit: int,
    timeout_at: float,
) -> tuple[list[int], list[int]] | None:
    """Return (order of stop indices 1..n, arrival seconds) or None if infeasible/timeout.

    Node 0 is the start. `stay[0]` is 0. `travel` is (n+1) x (n+1).
    locked_at maps visit-position (1-based among stops) -> node index.
    """
    n = len(travel) - 1
    if n == 0:
        return ([], [])
    full = (1 << n) - 1
    dp: dict[tuple[int, int], tuple[int, int]] = {}
    # dp[mask, last] = (arrival_time_at_last, prev_last)
    for node in range(1, n + 1):
        if 1 in locked_at and locked_at[1] != node:
            continue
        arrive = travel[0][node]
        open_t, close_t = windows[node]
        arrive = max(arrive, open_t)
        depart = arrive + stay[node]
        if arrive > close_t or depart > closes[node] or depart > return_limit:
            continue
        dp[(1 << (node - 1), node)] = (arrive, 0)

    for mask in range(1, full + 1):
        if time.monotonic() > timeout_at:
            return None
        visited = bin(mask).count("1")
        for last in range(1, n + 1):
            bit = 1 << (last - 1)
            if mask & bit == 0:
                continue
            if last in locked_at.values() and locked_at.get(visited) not in {None, last}:
                continue
            state = (mask, last)
            if state not in dp:
                continue
            arrive_last, _prev = dp[state]
            depart_last = arrive_last + stay[last]
            for nxt in range(1, n + 1):
                nbit = 1 << (nxt - 1)
                if mask & nbit:
                    continue
                next_count = visited + 1
                if next_count in locked_at and locked_at[next_count] != nxt:
                    continue
                arrive = depart_last + travel[last][nxt]
                open_t, close_t = windows[nxt]
                arrive = max(arrive, open_t)
                depart = arrive + stay[nxt]
                if arrive > close_t or depart > closes[nxt] or depart > return_limit:
                    continue
                candidate = (mask | nbit, nxt)
                best = dp.get(candidate)
                if best is None or arrive < best[0]:
                    dp[candidate] = (arrive, last)

    best_end: tuple[int, int, int] | None = None  # return_time, last, arrive
    for last in range(1, n + 1):
        state = (full, last)
        if state not in dp:
            continue
        arrive_last, _ = dp[state]
        ret = arrive_last + stay[last] + travel[last][0]
        if ret > return_limit:
            continue
        if best_end is None or ret < best_end[0]:
            best_end = (ret, last, arrive_last)
    if best_end is None:
        return None
    _ret, last, _arrive = best_end
    order: list[int] = []
    arrivals: list[int] = []
    mask = full
    while last != 0:
        arrive, prev = dp[(mask, last)]
        order.append(last)
        arrivals.append(arrive)
        mask ^= 1 << (last - 1)
        last = prev
    order.reverse()
    arrivals.reverse()
    return order, arrivals


def _simulate(
    order: list[int],
    travel: list[list[int]],
    stay: list[int],
    windows: list[tuple[int, int]],
    closes: list[int],
    return_limit: int,
) -> list[int] | None:
    t = 0
    arrivals: list[int] = []
    prev = 0
    for node in order:
        t += travel[prev][node]
        open_t, close_t = windows[node]
        t = max(t, open_t)
        if t > close_t or t + stay[node] > closes[node]:
            return None
        arrivals.append(t)
        t += stay[node]
        if t > return_limit:
            return None
        prev = node
    if t + travel[prev][0] > return_limit:
        return None
    return arrivals


def optimize_route(
    start_lat: float,
    start_lng: float,
    stops: list[OptimizeStop],
    window_start: datetime,
    return_by: datetime,
    mode: str = "driving",
    plan_id: str = "anon",
    timeout_ms: int = 2000,
    routing: RoutingService | None = None,
) -> OptimizeResult:
    started = time.monotonic()
    timeout_at = started + max(timeout_ms, 50) / 1000.0
    origin = window_start if window_start.tzinfo else window_start.replace(tzinfo=timezone.utc)
    deadline = return_by if return_by.tzinfo else return_by.replace(tzinfo=timezone.utc)
    return_limit = max(int((deadline - origin).total_seconds()), 0)
    service = routing or RoutingService()

    coords = [(start_lat, start_lng)] + [(stop.lat, stop.lng) for stop in stops]
    grid, cost = service.matrix(coords, mode=mode, departure_at=origin, plan_id=plan_id)
    metrics_available = all(leg.available for row in grid for leg in row)
    n = len(stops)
    stay = [0] + [stop.duration_minutes * 60 for stop in stops]
    windows: list[tuple[int, int]] = [(0, INF)]
    closes: list[int] = [INF]
    locked_at: dict[int, int] = {}
    for index, stop in enumerate(stops, start=1):
        open_t = _seconds_since(origin, stop.window_start, 0)
        close_t = _seconds_since(origin, stop.window_end, INF)
        windows.append((open_t, close_t))
        closes.append(_seconds_since(origin, stop.closes_at, INF))
        if stop.locked:
            position = stop.position or index
            locked_at[position] = index

    if metrics_available:
        travel = [[leg.duration_seconds or INF for leg in row] for row in grid]
        solver_name = "held-karp"
    else:
        travel = _haversine_matrix(coords, mode)
        solver_name = "held-karp-internal"

    timeout = False
    fallback = False
    reason: str | None = None
    solved = _held_karp(travel, stay, windows, closes, locked_at, return_limit, timeout_at)
    if solved is None and time.monotonic() > timeout_at:
        timeout = True
        fallback = True
        solver_name = "timeout-fallback"
        order = list(range(1, n + 1))
        arrivals = _simulate(order, travel, stay, windows, closes, return_limit)
        if arrivals is None:
            return _infeasible(
                "Solver timed out and the original order is infeasible",
                solver_name,
                True,
                True,
                cost,
                started,
                origin,
                deadline,
            )
    elif solved is None:
        order = list(range(1, n + 1))
        arrivals = _simulate(order, travel, stay, windows, closes, return_limit)
        if arrivals is None:
            return _infeasible(
                "No feasible sequence honours locked stops, appointment windows, closing times and return-by",
                solver_name,
                False,
                False,
                cost,
                started,
                origin,
                deadline,
            )
        fallback = True
        solver_name = "deterministic-fallback"
        reason = "Optimiser found no improving feasible tour; original order is feasible"
    else:
        order, arrivals = solved

    for position, node in locked_at.items():
        if position < 1 or position > len(order) or order[position - 1] != node:
            return _infeasible(
                "Locked stop could not keep its position",
                solver_name,
                fallback,
                timeout,
                cost,
                started,
                origin,
                deadline,
            )

    ordered_stops = _materialize(stops, order, arrivals, origin)
    display_legs, total_distance, total_duration, metrics_ok = _validate_legs(
        service, start_lat, start_lng, ordered_stops, mode, origin, plan_id, metrics_available
    )
    return OptimizeResult(
        feasible=True,
        reason=reason,
        solver=solver_name,
        fallback=fallback,
        timeout=timeout,
        ordered=ordered_stops,
        legs=display_legs,
        total_distance_m=total_distance if metrics_ok else None,
        total_duration_seconds=total_duration if metrics_ok else None,
        metrics_available=metrics_ok,
        routing_cost=cost,
        solve_ms=(time.monotonic() - started) * 1000,
        window_start=origin,
        return_by=deadline,
    )


def _materialize(
    stops: list[OptimizeStop],
    order: list[int],
    arrivals: list[int],
    origin: datetime,
) -> list[SolveStop]:
    result: list[SolveStop] = []
    for position, (node, arrive) in enumerate(zip(order, arrivals), start=1):
        stop = stops[node - 1]
        arrives = origin + timedelta(seconds=arrive)
        departs = arrives + timedelta(minutes=stop.duration_minutes)
        result.append(
            SolveStop(
                id=stop.id,
                label=stop.label,
                lat=stop.lat,
                lng=stop.lng,
                position=position,
                locked=stop.locked,
                arrives_at=arrives,
                departs_at=departs,
                duration_minutes=stop.duration_minutes,
                weather_sensitivity=stop.weather_sensitivity,
                estimated_minor=stop.estimated_minor,
            )
        )
    return result


def _validate_legs(
    service: RoutingService,
    start_lat: float,
    start_lng: float,
    ordered: list[SolveStop],
    mode: str,
    origin: datetime,
    plan_id: str,
    prior_available: bool,
) -> tuple[list[RouteLeg], int | None, int | None, bool]:
    points = [(start_lat, start_lng)] + [(stop.lat, stop.lng) for stop in ordered] + [(start_lat, start_lng)]
    legs: list[RouteLeg] = []
    available = prior_available
    distance = 0
    duration = 0
    for index in range(len(points) - 1):
        olat, olng = points[index]
        dlat, dlng = points[index + 1]
        leg = service.route(olat, olng, dlat, dlng, mode=mode, departure_at=origin, plan_id=plan_id)
        legs.append(leg)
        if not leg.available or leg.distance_m is None or leg.duration_seconds is None:
            available = False
        else:
            distance += leg.distance_m
            duration += leg.duration_seconds
    if not available:
        for leg in legs:
            if not leg.available:
                continue
            # Displayed metrics must not mix stub numbers into an unavailable provider result.
            if leg.source == "haversine-stub" and service.provider.name == "google":
                leg.available = False
                leg.source = "unavailable"
                leg.distance_m = None
                leg.duration_seconds = None
        return legs, None, None, False
    return legs, distance, duration, True


def _infeasible(
    reason: str,
    solver: str,
    fallback: bool,
    timeout: bool,
    cost: RoutingCost,
    started: float,
    origin: datetime,
    deadline: datetime,
) -> OptimizeResult:
    return OptimizeResult(
        feasible=False,
        reason=reason,
        solver=solver,
        fallback=fallback,
        timeout=timeout,
        ordered=[],
        legs=[],
        total_distance_m=None,
        total_duration_seconds=None,
        metrics_available=False,
        routing_cost=cost,
        solve_ms=(time.monotonic() - started) * 1000,
        window_start=origin,
        return_by=deadline,
    )
