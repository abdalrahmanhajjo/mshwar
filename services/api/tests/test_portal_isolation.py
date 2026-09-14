from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.context import clear_session_context, set_local_gucs, set_session_context


@pytest.mark.asyncio
async def test_backend_role_cannot_read_foreign_org_portal_rows(db_session) -> None:
    org_a = str(uuid4())
    org_b = str(uuid4())
    user_a = str(uuid4())
    user_b = str(uuid4())

    await db_session.execute(
        text(
            """
            INSERT INTO app.users (id, auth_issuer, auth_subject, display_name)
            VALUES
                (CAST(:id_a AS uuid), 'test', :sub_a, 'A'),
                (CAST(:id_b AS uuid), 'test', :sub_b, 'B')
            """
        ),
        {"id_a": user_a, "sub_a": user_a, "id_b": user_b, "sub_b": user_b},
    )
    await db_session.execute(
        text(
            """
            INSERT INTO app.organizations (id, name, slug, verification)
            VALUES (:oa, 'A', :sa, 'pending'), (:ob, 'B', :sb, 'pending')
            """
        ),
        {"oa": org_a, "ob": org_b, "sa": f"a-{org_a[:8]}", "sb": f"b-{org_b[:8]}"},
    )
    await db_session.execute(
        text(
            """
            INSERT INTO app.organization_members (organization_id, user_id, role)
            VALUES (:oa, :ua, 'owner'), (:ob, :ub, 'owner')
            """
        ),
        {"oa": org_a, "ob": org_b, "ua": user_a, "ub": user_b},
    )
    await db_session.execute(
        text(
            """
            INSERT INTO app.verification_documents
                (organization_id, object_key, filename, content_type, byte_size, created_by)
            VALUES (:ob, 'private/b.pdf', 'b.pdf', 'application/pdf', 12, :ub)
            """
        ),
        {"ob": org_b, "ub": user_b},
    )
    await db_session.commit()

    await db_session.execute(text("SET ROLE mshwar_backend"))
    set_session_context(user_id=user_a, organization_id=org_a)
    await set_local_gucs(db_session, user_id=user_a, organization_id=org_a)
    docs = (
        await db_session.execute(
            text("SELECT id FROM app.verification_documents WHERE organization_id = :org"),
            {"org": org_b},
        )
    ).fetchall()
    orgs = (
        await db_session.execute(
            text("SELECT id FROM app.organizations WHERE id = :org"),
            {"org": org_b},
        )
    ).fetchall()
    await db_session.execute(text("RESET ROLE"))
    await db_session.execute(text("RESET app.user_id"))
    await db_session.execute(text("RESET app.organization_id"))
    clear_session_context()
    assert docs == []
    assert orgs == []
