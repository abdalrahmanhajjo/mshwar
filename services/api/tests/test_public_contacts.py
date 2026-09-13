from __future__ import annotations

from app.api.v1.endpoints.businesses import public_organization_view
from app.api.v1.endpoints.portal import bookings_to_csv, metrics_to_csv


def test_public_serializer_drops_internal_fields() -> None:
    payload = {
        "id": "org-1",
        "name": "Cedar",
        "public_contact": {"email": "hello@example.com"},
        "internal_contact": {"email": "ops@example.com"},
        "fulfilment_instructions": "secret",
        "organization": {
            "public_contact": {"email": "hello@example.com"},
            "internal_contact": {"phone": "01"},
            "fulfilment_instructions": "nope",
        },
    }
    public = public_organization_view(payload)
    assert public is not None
    assert "internal_contact" not in public
    assert "fulfilment_instructions" not in public
    assert "internal_contact" not in public["organization"]
    assert public["public_contact"]["email"] == "hello@example.com"
    assert public_organization_view(None) is None


def test_bookings_and_metrics_csv() -> None:
    csv_text = bookings_to_csv(
        [
            {
                "id": "b1",
                "status": "pending",
                "party_size": 2,
                "experience_title": "Tasting",
                "starts_at": "2026-09-20T10:00:00+00:00",
                "capacity": 10,
                "reserved": 2,
                "remaining": 8,
                "total_minor": 9000,
                "currency": "USD",
                "traveller_note": "Window",
            }
        ]
    )
    assert "Tasting" in csv_text
    assert "Window" in csv_text
    metrics = metrics_to_csv(
        {
            "from": "a",
            "to": "b",
            "comparison_from": "c",
            "comparison_to": "d",
            "current": {
                "views": 3,
                "saves": 1,
                "itinerary_inclusions": 0,
                "requests": 2,
                "confirmations": 1,
                "revenue_minor": 9000,
            },
            "previous": {
                "views": 1,
                "saves": 0,
                "itinerary_inclusions": 0,
                "requests": 1,
                "confirmations": 0,
                "revenue_minor": 0,
            },
        }
    )
    assert "revenue_minor" in metrics
    assert "9000" in metrics
