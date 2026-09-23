"""The session variables row-level security is written against are actually set.

Migration 006 scopes every org-owned table with app.current_organization_id()
and app.current_user_id(), which read the `app.organization_id` and
`app.user_id` settings. Nothing on the request path had ever set them, so those
policies evaluated against NULL. That is fail-closed rather than leaky - the
portal works because it goes through SECURITY DEFINER functions - but it means
the tenant boundary was doing no work, and anything added later that touches a
table directly would inherit a policy that cannot match.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.dependencies import bind_actor, bind_organization
from tests.conftest import TestingSessionLocal


@pytest.mark.asyncio
async def test_binding_an_actor_answers_both_the_audit_trigger_and_rls() -> None:
    user_id = uuid4()
    async with TestingSessionLocal() as session:
        await bind_actor(session, user_id)
        row = (
            (
                await session.execute(
                    text(
                        "SELECT current_setting('app.actor_id', true) AS actor, app.current_user_id()::text AS rls_user"
                    )
                )
            )
            .mappings()
            .one()
        )
    assert row["actor"] == str(user_id), "the audit trigger reads app.actor_id"
    assert row["rls_user"] == str(user_id), "the RLS helper reads app.user_id"


@pytest.mark.asyncio
async def test_an_organisation_scope_can_be_set_and_cleared() -> None:
    organization_id = uuid4()
    async with TestingSessionLocal() as session:
        await bind_organization(session, organization_id)
        scoped = (await session.execute(text("SELECT app.current_organization_id()::text"))).scalar()
        assert scoped == str(organization_id)

        # Clearing must deny, not widen: the policies compare against NULL.
        await bind_organization(session, None)
        cleared = (await session.execute(text("SELECT app.current_organization_id()"))).scalar()
    assert cleared is None


@pytest.mark.asyncio
async def test_the_scope_does_not_leak_between_transactions() -> None:
    """set_config(..., true) is transaction-local, which is what makes this safe."""
    async with TestingSessionLocal() as first:
        await bind_actor(first, uuid4())
        await first.rollback()
        leaked = (await first.execute(text("SELECT app.current_user_id()"))).scalar()
    assert leaked is None
