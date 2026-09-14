"""Shared endpoint policy. New endpoints require a session unless explicitly public."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies import get_auth_db

# Qualified names avoid accidentally making a similarly named private endpoint public.
PUBLIC = {
    "health.health",
    "auth.register",
    "auth.signin",
    "auth.signout",
    "auth.forgot_password",
    "auth.reset_password",
    "auth.verify_email",
    "auth.resend_verification",
    "businesses.list_businesses",
    "businesses.get_business",
    "businesses.get_public_experience",
    "catalogue.list_destinations",
    "catalogue.list_experiences",
    "catalogue.get_experience",
    "catalogue.related_experiences",
    "catalogue.search_catalogue",
    "catalogue.list_collections",
    "catalogue.get_collection",
    "locations.list_areas",
    "profile.get_vocabularies",
    "portal.get_lebanon_bounds",
    "portal.get_taxonomy",
    "checkout.list_slots",
    "checkout.quote_checkout",
    "reviews.list_public_reviews",
    "reviews.review_aggregates",
}
CAPABILITY = {
    "portal.download_signed_file",
    "groups.peek_share_link",
    "groups.join_share_link",
    "webhooks.payment_webhook",
    "notifications.lookup_unsubscribe",
    "notifications.apply_unsubscribe",
    "notifications.dispatch_outbox",
    "notifications.escalate_requests",
}
GUEST = {
    "groups.get_group_trip",
    "groups.list_participants",
    "groups.add_suggestion",
    "groups.list_suggestions",
    "groups.cast_vote",
    "groups.vote_tally",
    "groups.group_summary",
}
ADMIN = {
    "catalogue.upsert_collection",
    "catalogue.publish_experience",
    "catalogue.unpublish_experience",
    "checkout.expire_holds",
    "checkout.publish_outbox_endpoint",
    "checkout.checkout_metrics",
}


def endpoint_key(request: Request) -> str:
    endpoint = request.scope["endpoint"]
    return f"{endpoint.__module__.rsplit('.', 1)[-1]}.{endpoint.__name__}"


def deny_object() -> None:
    raise HTTPException(404, "Resource not found")


async def require_object(db: AsyncSession, user_id: object, resource: str, object_id: object) -> None:
    allowed = await db.scalar(
        text("SELECT app.security_can_access(:actor, :resource, :target)"),
        {"actor": str(user_id), "resource": resource, "target": str(object_id)},
    )
    if not allowed:
        deny_object()


async def enforce_endpoint(request: Request, db: AsyncSession = Depends(get_auth_db)) -> None:  # noqa: B008
    from app.api.v1.endpoints.auth import _load_session
    from app.core.security_limits import enforce_limits
    from app.core.sessions import COOKIE_NAME

    origin = request.headers.get("origin")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and origin not in settings.allowed_origins:
        raise HTTPException(403, "Origin not allowed")
    key = endpoint_key(request)
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session and session["status"] != "active":
        session = None
    request.state.security_actor = session
    await enforce_limits(request, key, session)
    if key not in PUBLIC | CAPABILITY | GUEST and session is None:
        raise HTTPException(401, "Not authenticated")
    if key in GUEST and session is None and not request.cookies.get("mshwar_guest"):
        raise HTTPException(401, "Not authenticated")
    if session:
        await db.execute(text("SELECT set_config('app.user_id', :actor, true)"), {"actor": str(session["user_id"])})
    if session or request.method not in {"GET", "HEAD", "OPTIONS"}:
        await db.execute(
            text("SELECT set_config('app.request_id', :value, true)"),
            {"value": getattr(request.state, "request_id", "")},
        )
        await db.execute(text("SELECT set_config('app.reason', :value, true)"), {"value": key})
    if key in ADMIN:
        from app.core.admin_auth import require_admin

        await require_admin(request, db)
    if session and key.startswith("portal.") and "org_id" in request.path_params:
        org = str(request.path_params["org_id"])
        await require_object(db, session["user_id"], "organization", org)
        await db.execute(text("SELECT set_config('app.organization_id', :org, true)"), {"org": org})
