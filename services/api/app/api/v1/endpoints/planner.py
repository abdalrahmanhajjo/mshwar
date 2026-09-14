from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.session import require_session
from app.core.config import settings
from app.core.portal_auth import fetch_json
from app.dependencies import get_auth_db
from app.planner.optimizer import OptimizeStop, optimize_route
from app.planner.replan import replan_affected
from app.planner.routing import (
    RouteLeg,
    RoutingCost,
    RoutingService,
    cache_key,
    persist_cost,
    persist_leg,
    time_bucket,
)
from app.planner.warnings import WarningStop, evaluate_warnings
from app.planner.weather import WeatherService, persist_forecast
from app.schemas.planner import (
    Coordinate,
    ForecastOut,
    ForecastQuery,
    OptimizeRequest,
    OptimizeResponse,
    OrderedStopOut,
    ReplanDiffOut,
    ReplanRequest,
    ReplanResponse,
    RouteLegOut,
    RouteRequest,
    RoutingCostOut,
    WarningEvalRequest,
    WarningEvalResponse,
    WeatherWarningOut,
)

router = APIRouter()


def _leg_out(leg: RouteLeg) -> RouteLegOut:
    return RouteLegOut(
        origin=Coordinate(lat=leg.origin_lat, lng=leg.origin_lng),
        destination=Coordinate(lat=leg.dest_lat, lng=leg.dest_lng),
        mode=leg.mode,
        available=leg.available,
        provider=leg.provider,
        source=leg.source,
        distance_m=leg.distance_m,
        duration_seconds=leg.duration_seconds,
        cache_hit=leg.cache_hit,
        time_bucket=leg.time_bucket,
        fetched_at=leg.fetched_at,
        presented_as=leg.presented_as,
    )


def _cost_out(cost: RoutingCost) -> RoutingCostOut:
    budget = int(settings.routing_plan_budget_usd * 1_000_000)
    return RoutingCostOut(
        plan_id=cost.plan_id,
        provider=cost.provider,
        elements_requested=cost.elements_requested,
        cache_hits=cost.cache_hits,
        cache_misses=cost.cache_misses,
        estimated_usd_micros=cost.estimated_usd_micros,
        within_budget=cost.estimated_usd_micros <= budget,
        budget_usd_micros=budget,
        documented_rate=cost.documented_rate,
    )


def _stop_models(payload: OptimizeRequest) -> list[OptimizeStop]:
    return [
        OptimizeStop(
            id=item.id,
            lat=item.lat,
            lng=item.lng,
            label=item.label,
            duration_minutes=item.duration_minutes,
            locked=item.locked,
            position=item.position,
            window_start=item.window_start,
            window_end=item.window_end,
            closes_at=item.closes_at,
            weather_sensitivity=item.weather_sensitivity,
            estimated_minor=item.estimated_minor,
        )
        for item in payload.stops
    ]


def _optimize_response(result: Any) -> OptimizeResponse:
    return OptimizeResponse(
        feasible=result.feasible,
        reason=result.reason,
        solver=result.solver,
        fallback=result.fallback,
        timeout=result.timeout,
        ordered_stops=[
            OrderedStopOut(
                id=stop.id,
                label=stop.label,
                lat=stop.lat,
                lng=stop.lng,
                position=stop.position,
                locked=stop.locked,
                arrives_at=stop.arrives_at,
                departs_at=stop.departs_at,
                duration_minutes=stop.duration_minutes,
                weather_sensitivity=stop.weather_sensitivity,
                estimated_minor=stop.estimated_minor,
            )
            for stop in result.ordered
        ],
        legs=[_leg_out(leg) for leg in result.legs],
        total_distance_m=result.total_distance_m,
        total_duration_seconds=result.total_duration_seconds,
        metrics_available=result.metrics_available,
        routing_cost=_cost_out(result.routing_cost),
        solve_ms=result.solve_ms,
        window_start=result.window_start,
        return_by=result.return_by,
    )


@router.post("/route", response_model=RouteLegOut)
async def route_leg(
    payload: RouteRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> RouteLegOut:
    await require_session(request, db)
    service = RoutingService()
    plan_id = payload.plan_id or "anon"
    mode = payload.mode if payload.mode in {"driving", "walking", "transit"} else "driving"
    leg = service.route(
        payload.origin.lat,
        payload.origin.lng,
        payload.destination.lat,
        payload.destination.lng,
        mode=mode,
        departure_at=payload.departure_at,
        plan_id=plan_id,
    )
    await persist_leg(
        db,
        cache_key(
            payload.origin.lat,
            payload.origin.lng,
            payload.destination.lat,
            payload.destination.lng,
            mode,
            time_bucket(payload.departure_at, settings.routing_time_bucket_minutes),
        ),
        leg,
    )
    await persist_cost(db, service.last_cost)
    return _leg_out(leg)


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_plan(
    payload: OptimizeRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> OptimizeResponse:
    await require_session(request, db)
    if payload.return_by <= payload.window_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="return_by must be after window_start"
        )
    result = optimize_route(
        payload.start.lat,
        payload.start.lng,
        _stop_models(payload),
        payload.window_start,
        payload.return_by,
        mode=payload.mode,
        plan_id=payload.plan_id or "anon",
        timeout_ms=payload.timeout_ms,
    )
    await persist_cost(db, result.routing_cost)
    return _optimize_response(result)


@router.post("/weather", response_model=ForecastOut)
async def weather_forecast(
    payload: ForecastQuery,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ForecastOut:
    await require_session(request, db)
    try:
        day = date.fromisoformat(payload.forecast_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid forecast date") from exc
    service = WeatherService()
    forecast = service.forecast(payload.lat, payload.lng, day)
    await persist_forecast(db, forecast)
    return ForecastOut(
        available=forecast.available,
        provider=forecast.provider,
        source=forecast.source,
        fetched_at=forecast.fetched_at,
        forecast_date=forecast.forecast_date.isoformat(),
        lat=forecast.lat,
        lng=forecast.lng,
        precip_mm=forecast.precip_mm,
        wind_kmh=forecast.wind_kmh,
        temp_max_c=forecast.temp_max_c,
        temp_min_c=forecast.temp_min_c,
        weather_code=forecast.weather_code,
        attribution=forecast.attribution,
    )


@router.post("/warnings", response_model=WarningEvalResponse)
async def weather_warnings(
    payload: WarningEvalRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> WarningEvalResponse:
    await require_session(request, db)
    stops: list[WarningStop] = []
    for item in payload.stops:
        try:
            day = date.fromisoformat(item.forecast_date)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid forecast date"
            ) from exc
        stops.append(
            WarningStop(
                id=item.id,
                label=item.label,
                lat=item.lat,
                lng=item.lng,
                forecast_date=day,
                weather_sensitivity=item.weather_sensitivity,
            )
        )
    result = evaluate_warnings(stops, booking_statuses=dict(payload.booking_statuses))
    return WarningEvalResponse(
        warnings=[
            WeatherWarningOut(
                stop_id=item.stop_id,
                stop_label=item.stop_label,
                severity=item.severity,
                reasons=item.reasons,
                source=item.source,
                fetched_at=item.fetched_at,
                forecast_date=item.forecast_date.isoformat(),
            )
            for item in result.warnings
        ],
        forecast_unavailable=result.forecast_unavailable,
        bookings_mutated=result.bookings_mutated,
        booking_statuses=result.booking_statuses,
    )


@router.post("/replan", response_model=ReplanResponse)
async def replan_plan(
    payload: ReplanRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ReplanResponse:
    await require_session(request, db)
    plan = payload.plan
    result = replan_affected(
        plan.start.lat,
        plan.start.lng,
        _stop_models(plan),
        payload.affected_stop_ids,
        [
            OptimizeStop(
                id=item.id,
                lat=item.lat,
                lng=item.lng,
                label=item.label,
                duration_minutes=item.duration_minutes,
                locked=item.locked,
                position=item.position,
                window_start=item.window_start,
                window_end=item.window_end,
                closes_at=item.closes_at,
                weather_sensitivity=item.weather_sensitivity,
                estimated_minor=item.estimated_minor,
            )
            for item in payload.candidates
        ],
        plan.window_start,
        plan.return_by,
        mode=plan.mode,
        plan_id=plan.plan_id or "anon",
        timeout_ms=plan.timeout_ms,
        booking_statuses=dict(payload.booking_statuses),
    )
    return ReplanResponse(
        feasible=result.feasible,
        applied=result.applied,
        message=result.message,
        before=_optimize_response(result.before) if result.before is not None else None,
        after=_optimize_response(result.after) if result.after is not None else None,
        diff=ReplanDiffOut(
            removed=result.diff.removed,
            added=result.diff.added,
            unchanged=result.diff.unchanged,
            time_delta_seconds=result.diff.time_delta_seconds,
            cost_delta_minor=result.diff.cost_delta_minor,
        )
        if result.diff
        else None,
        bookings_mutated=result.bookings_mutated,
        booking_statuses=result.booking_statuses,
    )


@router.get("/thresholds")
async def list_thresholds(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    await require_session(request, db)
    return await fetch_json(db, "SELECT app.list_weather_thresholds()", {})
