from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Any

import psycopg  # type: ignore

from app.seed.lebanese_data import (
    ALL_EXPERIENCES,
    ORGANIZATIONS_DATA,
    TAXONOMY_TERMS,
    VENUES_DATA,
    validate_experiences,
    validate_venue_coordinates,
)
from app.seed.validation import (
    REGIONS,
    get_region_by_slug,
    validate_all_categories,
    validate_all_regions,
)

DB_URL_ENV = "DATABASE_URL"


def get_connection(db_url: str | None = None) -> psycopg.Connection:
    """Get a psycopg connection to the database."""
    import os

    url = db_url or os.environ.get(DB_URL_ENV)
    if not url:
        raise ValueError("DATABASE_URL must be set or passed as argument")
    conn = psycopg.connect(url, autocommit=False)
    conn.set_session(readonly=False)
    return conn


def setup_session_context(conn: psycopg.Connection, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Set the RLS session context so seeder can bypass RLS."""
    conn.execute("SET LOCAL app.user_id = :user_id", {"user_id": str(user_id)})
    conn.execute("SET LOCAL app.organization_id = :org_id", {"org_id": str(org_id)})


def reset_session_context(conn: psycopg.Connection) -> None:
    """Reset the RLS session context."""
    conn.execute("RESET app.user_id")
    conn.execute("RESET app.organization_id")
    conn.execute("RESET app.request_id")


def upsert_tenant(
    conn: psycopg.Connection, table: str, data: dict[str, Any], conflict_cols: list[str]
) -> uuid.UUID | None:
    """Generic upsert helper. Returns the row id."""
    cols = list(data.keys())
    col_names = ", ".join(cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    conflict_clause = ", ".join(conflict_cols)
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "id")

    sql = f"""
        INSERT INTO app.{table} ({col_names}) VALUES ({placeholders})
        ON CONFLICT ({conflict_clause}) DO UPDATE SET {update_set}
        RETURNING id
    """
    try:
        row = conn.execute(sql, data).fetchone()
        return row["id"] if row else None
    except Exception:
        conn.rollback()
        raise


def seed_taxonomy(conn: psycopg.Connection) -> dict[str, uuid.UUID]:
    """Seed taxonomy terms and return a mapping of slug to id."""
    term_ids: dict[str, uuid.UUID] = {}
    for term in TAXONOMY_TERMS:
        sql = """
            INSERT INTO app.taxonomy (id, kind, slug, label, active)
            VALUES (:id, :kind, :slug, :label, :active)
            ON CONFLICT (kind, slug) DO UPDATE SET label = EXCLUDED.label, active = EXCLUDED.active
            RETURNING id
        """
        row = conn.execute(
            sql,
            {
                "id": uuid.uuid4(),
                "kind": term["kind"],
                "slug": term["slug"],
                "label": term["label"],
                "active": True,
            },
        ).fetchone()
        term_ids[term["slug"]] = row["id"]
    return term_ids


def seed_destinations(conn: psycopg.Connection) -> dict[str, uuid.UUID]:
    """Seed Lebanon destinations and return slug -> id mapping."""
    dest_ids: dict[str, uuid.UUID] = {}
    for region in REGIONS:
        sql = """
            INSERT INTO app.destinations (id, slug, country_code, name)
            VALUES (:id, :slug, :country_code, :name)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """
        row = conn.execute(
            sql,
            {
                "id": uuid.uuid4(),
                "slug": region.slug,
                "country_code": "LB",
                "name": region.name,
            },
        ).fetchone()
        dest_ids[region.slug] = row["id"]
    return dest_ids


def seed_organizations(conn: psycopg.Connection) -> dict[str, uuid.UUID]:
    """Seed organizations and return slug -> id mapping."""
    org_ids: dict[str, uuid.UUID] = {}
    for org in ORGANIZATIONS_DATA:
        sql = """
            INSERT INTO app.organizations (id, name, slug, status, verification)
            VALUES (:id, :name, :slug, :status, :verification)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """
        row = conn.execute(
            sql,
            {
                "id": org["id"],
                "name": org["name"],
                "slug": org["slug"],
                "status": "active",
                "verification": org["verification"],
            },
        ).fetchone()
        org_ids[org["slug"]] = row["id"]
    return org_ids


def seed_venues(
    conn: psycopg.Connection, org_ids: dict[str, uuid.UUID], dest_ids: dict[str, uuid.UUID]
) -> dict[str, uuid.UUID]:
    """Seed venues and return venue id -> venue data."""
    venue_ids: dict[str, uuid.UUID] = {}
    for venue in VENUES_DATA:
        dest = get_region_by_slug(venue["destination_slug"])
        org_id = org_ids.get(venue["org_id"])
        if not org_id or not dest:
            continue
        sql = """
            INSERT INTO app.venues (id, organization_id, destination_id, name, address, timezone, location, location_source)
            VALUES (:id, :org_id, :dest_id, :name, :address, :timezone, :location, :source)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
            RETURNING id
        """
        location = f"ST_SetSRID(ST_MakePoint({venue['lng']}, {venue['lat']}), 4326)::geography"
        row = conn.execute(
            sql,
            {
                "id": venue["id"],
                "org_id": org_id,
                "dest_id": dest_ids[venue["destination_slug"]],
                "name": venue["name"],
                "address": venue["address"],
                "timezone": "Asia/Beirut",
                "location": location,
                "source": "seeder",
            },
        ).fetchone()
        venue_ids[str(venue["id"])] = row["id"]
    return venue_ids


def seed_opening_hours(conn: psycopg.Connection, venue_ids: dict[str, uuid.UUID]) -> None:
    """Seed opening hours for all venues."""
    weekdays = [0, 1, 2, 3, 4, 5, 6]
    for venue_id in venue_ids:
        # 6 days a week (closed Sunday), 10am-10pm
        for wd in weekdays:
            if wd == 0:
                continue
            sql = """
                INSERT INTO app.opening_hours (id, venue_id, weekday, opens, closes)
                VALUES (:id, :venue_id, :weekday, :opens, :closes)
                ON CONFLICT (venue_id, weekday, opens) DO NOTHING
            """
            conn.execute(
                sql,
                {
                    "id": uuid.uuid4(),
                    "venue_id": uuid.UUID(venue_id),
                    "weekday": wd,
                    "opens": time(10, 0),
                    "closes": time(22, 0),
                },
            )


def seed_experiences(
    conn: psycopg.Connection,
    org_ids: dict[str, uuid.UUID],
    venue_ids: dict[str, uuid.UUID],
    term_ids: dict[str, uuid.UUID],
    dest_ids: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    """Seed all experiences and return slug -> id."""
    exp_ids: dict[str, uuid.UUID] = {}
    for exp_data in ALL_EXPERIENCES:
        venue_id_str = str(exp_data["venue_id"])
        venue_id = venue_ids.get(venue_id_str)
        org_id = org_ids.get(str(exp_data["organization_id"]))
        if not venue_id or not org_id:
            continue

        experience = {
            "id": exp_data["id"],
            "slug": exp_data["slug"],
            "title": exp_data["title"],
            "description": exp_data["description"],
            "organization_id": org_id,
            "venue_id": venue_id,
            "status": "published",
            "booking_mode": exp_data["booking_mode"],
            "duration_minutes": exp_data["duration_minutes"],
            "min_party": exp_data["min_party"],
            "max_party": exp_data["max_party"],
            "min_age": exp_data["min_age"],
            "setting": exp_data["setting"],
            "intensity": exp_data["intensity"],
            "freshness_seconds": 86400,
        }

        sql = """
            INSERT INTO app.experiences (id, organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes, min_party, max_party, min_age, setting, intensity, freshness_seconds)
            VALUES (:id, :organization_id, :venue_id, :slug, :title, :description, :status, :booking_mode, :duration_minutes, :min_party, :max_party, :min_age, :setting, :intensity, :freshness_seconds)
            ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status
            RETURNING id
        """
        row = conn.execute(sql, experience).fetchone()
        exp_id = row["id"]
        exp_ids[exp_data["slug"]] = exp_id

        # Seed experience_taxonomy
        term_sql = """
            INSERT INTO app.experience_taxonomy (experience_id, term_id) VALUES (:exp_id, :term_id)
            ON CONFLICT DO NOTHING
        """
        category = exp_data["category"]
        if category in term_ids:
            conn.execute(term_sql, {"exp_id": exp_id, "term_id": term_ids[category]})

        # Seed experience_translations
        for locale in ["en", "ar"]:
            trans_sql = """
                INSERT INTO app.experience_translations (experience_id, locale, title, description)
                VALUES (:exp_id, :locale, :title, :description)
                ON CONFLICT (experience_id, locale) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
            """
            conn.execute(
                trans_sql,
                {
                    "exp_id": exp_id,
                    "locale": locale,
                    "title": exp_data["title"],
                    "description": exp_data["description"],
                },
            )

    return exp_ids


def seed_price_rules(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    """Seed price rules for all experiences."""
    currency_codes = ["USD", "LBP", "EUR"]
    price_models = [
        {"price_type": "fixed", "unit": "person", "amount_minor": 2500},
        {"price_type": "fixed", "unit": "person", "amount_minor": 5000},
        {"price_type": "fixed", "unit": "group", "amount_minor": 15000},
        {"price_type": "range", "unit": "person", "amount_minor": 1500, "max_amount_minor": 8000},
        {"price_type": "quote", "unit": "person", "amount_minor": 0},
    ]
    now = datetime.now(timezone.utc)
    for slug, exp_id in exp_ids.items():
        for currency in currency_codes[:1]:  # USD only for seeder simplicity
            price = price_models[hash(slug) % len(price_models)]
            sql = """
                INSERT INTO app.price_rules (id, experience_id, currency, price_type, unit, amount_minor, max_amount_minor, valid_during, source)
                VALUES (:id, :exp_id, :currency, :price_type, :unit, :amount_minor, :max_amount_minor, :valid_during, :source)
                ON CONFLICT (experience_id, currency, price_type) DO NOTHING
            """
            conn.execute(
                sql,
                {
                    "id": uuid.uuid4(),
                    "exp_id": exp_id,
                    "currency": currency,
                    "price_type": price["price_type"],
                    "unit": price["unit"],
                    "amount_minor": price["amount_minor"],
                    "max_amount_minor": price.get("max_amount_minor", 0),
                    "valid_during": f"({now.isoformat()},)",
                    "source": "seeder",
                },
            )


def seed_policies(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    """Seed booking policies for all experiences."""
    for exp_id in exp_ids.values():
        sql = """
            INSERT INTO app.policies (id, experience_id, version, cancellation_rules, terms_text)
            VALUES (:id, :exp_id, :version, :cancellation_rules, :terms_text)
            ON CONFLICT (experience_id, version) DO NOTHING
        """
        conn.execute(
            sql,
            {
                "id": uuid.uuid4(),
                "exp_id": exp_id,
                "version": 1,
                "cancellation_rules": '{"free_before_hours": 24, "cancellation_fee_percent": 10}',
                "terms_text": "Standard booking terms and conditions apply.",
            },
        )


def seed_slots(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    """Seed time slots for all experiences."""
    now = datetime.now(timezone.utc)
    for exp_id in exp_ids.values():
        # Create 5 slots per experience over the next 7 days
        for day_offset in range(7):
            slot_date = now + timedelta(days=day_offset)
            for hour in [10, 14, 18]:
                starts = datetime(slot_date.year, slot_date.month, slot_date.day, hour, 0, tzinfo=timezone.utc)
                ends = starts + timedelta(minutes=120)
                sql = """
                    INSERT INTO app.slots (id, experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status)
                    VALUES (:id, :exp_id, :starts_at, :ends_at, :capacity, :reserved, :authoritative, :source, :observed_at, :status)
                    ON CONFLICT (experience_id, starts_at) DO NOTHING
                """
                conn.execute(
                    sql,
                    {
                        "id": uuid.uuid4(),
                        "exp_id": exp_id,
                        "starts_at": starts,
                        "ends_at": ends,
                        "capacity": 8,
                        "reserved": 0,
                        "authoritative": True,
                        "source": "seeder",
                        "observed_at": now,
                        "status": "open",
                    },
                )


def seed_media(conn: psycopg.Connection, exp_ids: dict[str, uuid.UUID]) -> None:
    """Seed media entries for all experiences."""
    for slug, exp_id in exp_ids.items():
        for i in range(1, 3):  # 2 images per experience
            sql = """
                INSERT INTO app.media (id, experience_id, provider, object_key, alt_text, sort_order, moderation)
                VALUES (:id, :exp_id, :provider, :object_key, :alt_text, :sort_order, :moderation)
                ON CONFLICT (provider, object_key) DO NOTHING
            """
            conn.execute(
                sql,
                {
                    "id": uuid.uuid4(),
                    "exp_id": exp_id,
                    "provider": "imagekit",
                    "object_key": f"experiences/{slug}/image-{i}.jpg",
                    "alt_text": f"{slug} image {i}",
                    "sort_order": i,
                    "moderation": "approved",
                },
            )


def run_seeder(db_url: str | None = None, validate: bool = True) -> dict[str, Any]:
    """Run the full Lebanon seeder. Returns summary of seeded data."""
    conn = get_connection(db_url)
    try:
        # Set session context to bypass RLS
        admin_user = uuid.UUID("00000000-0000-0000-0000-000000000001")
        admin_org = uuid.UUID("00000000-0000-0000-0000-000000000001")
        setup_session_context(conn, admin_org, admin_user)

        result: dict[str, Any] = {}

        # Run validations
        if validate:
            region_errors = validate_all_regions()
            if region_errors:
                raise ValueError(f"Region validation failed: {region_errors}")
            cat_errors = validate_all_categories()
            if cat_errors:
                raise ValueError(f"Category validation failed: {cat_errors}")
            venue_errors = validate_venue_coordinates()
            if venue_errors:
                raise ValueError(f"Venue coordinate validation failed: {venue_errors}")
            exp_errors = validate_experiences()
            if exp_errors:
                raise ValueError(f"Experience validation failed: {exp_errors}")

        # Seed in dependency order
        term_ids = seed_taxonomy(conn)
        result["taxonomy_terms"] = len(term_ids)

        dest_ids = seed_destinations(conn)
        result["destinations"] = len(dest_ids)

        org_ids = seed_organizations(conn)
        result["organizations"] = len(org_ids)

        venue_ids = seed_venues(conn, org_ids, dest_ids)
        result["venues"] = len(venue_ids)

        seed_opening_hours(conn, venue_ids)
        result["opening_hours"] = len(venue_ids) * 6

        exp_ids = seed_experiences(conn, org_ids, venue_ids, term_ids, dest_ids)
        result["experiences"] = len(exp_ids)

        seed_price_rules(conn, exp_ids)
        result["price_rules"] = len(exp_ids) * 3  # 3 currencies per experience

        seed_policies(conn, exp_ids)
        result["policies"] = len(exp_ids)

        seed_slots(conn, exp_ids)
        result["slots"] = len(exp_ids) * 5 * 3  # 5 days * 3 slots per day

        seed_media(conn, exp_ids)
        result["media"] = len(exp_ids) * 2

        conn.commit()
        result["status"] = "success"
        result["total_rows"] = (
            result["destinations"]
            + result["organizations"]
            + result["venues"]
            + result["experiences"]
            + result["price_rules"]
            + result["policies"]
            + result["slots"]
            + result["media"]
        )
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        reset_session_context(conn)
        conn.close()


if __name__ == "__main__":
    import sys

    db_url = sys.argv[1] if len(sys.argv) > 1 else None
    validate = "--no-validate" not in sys.argv
    result = run_seeder(db_url=db_url, validate=validate)
    print(f"Seeder complete: {result}")
