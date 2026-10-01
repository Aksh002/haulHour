from datetime import datetime, timedelta

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from planner.providers.base import ReverseGeocodeResult


@pytest.fixture
def client():
    return APIClient()


def test_health_and_readiness(client):
    assert client.get(reverse("health")).status_code == 200
    assert client.get(reverse("ready")).data["status"] == "ready"


def test_field_level_validation(client):
    response = client.post(reverse("trip-plan"), {"current_cycle_used_hours": 71}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "VALIDATION_ERROR"
    assert "current_location" in response.data["error"]["field_errors"]


def test_demo_autocomplete_uses_portable_cache_key(client):
    response = client.get(reverse("autocomplete"), {"q": "Chicago", "demo": "true"})
    assert response.status_code == 200
    assert response.data["results"][0]["label"] == "Chicago, IL"


def test_reverse_geocode_rejects_location_outside_us(client, monkeypatch):
    class OutsideProvider:
        def reverse_geocode_details(self, coordinate):
            return ReverseGeocodeResult("New Delhi, India", "IND", False)

    monkeypatch.setattr("planner.api.views.provider_for", lambda demo: OutsideProvider())
    response = client.post(
        reverse("reverse-geocode"),
        {"latitude": 28.6139, "longitude": 77.2090},
        format="json",
    )
    assert response.status_code == 422
    assert response.data["error"]["code"] == "LOCATION_OUTSIDE_US"


def test_demo_plan_returns_complete_contract(client):
    response = client.post(
        reverse("trip-plan"),
        {
            "current_location": "Chicago, IL",
            "pickup_location": "Denver, CO",
            "dropoff_location": "Los Angeles, CA",
            "current_cycle_used_hours": 18,
            "start_at": "2026-10-05T06:00:00-05:00",
            "terminal_timezone": "America/Chicago",
            "demo_mode": True,
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert len(response.data["route_legs"]) == 2
    assert response.data["events"]
    assert response.data["stops"]
    assert response.data["daily_logs"]
    assert response.data["summary"]["total_route_miles"] == 2020
    assert all(sum(log["totals_minutes"].values()) == 1440 for log in response.data["daily_logs"])


def test_replan_preserves_reported_progress_and_regenerates_remaining_trip(client):
    plan_response = client.post(
        reverse("trip-plan"),
        {
            "current_location": "Chicago, IL",
            "pickup_location": "Denver, CO",
            "dropoff_location": "Los Angeles, CA",
            "current_cycle_used_hours": 18,
            "start_at": "2026-10-05T06:00:00-05:00",
            "terminal_timezone": "America/Chicago",
            "demo_mode": True,
        },
        format="json",
    )
    plan = plan_response.data
    pickup = next(event for event in plan["events"] if event["event_type"] == "PICKUP")
    checkpoint = datetime.fromisoformat(pickup["end_at"]) + timedelta(hours=2)

    response = client.post(
        reverse("trip-replan"),
        {
            "plan_id": plan["plan_id"],
            "last_completed_event_id": pickup["id"],
            "checkpoint_at": checkpoint.isoformat(),
            "current_location": "Denver, CO",
            "delay_duty_status": "ON_DUTY_NOT_DRIVING",
        },
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["parent_plan_id"] == plan["plan_id"]
    assert response.data["plan_version"] == 2
    assert response.data["replan"]["delay_minutes"] == 120
    assert response.data["replan"]["pickup_complete"] is True
    assert len(response.data["route_legs"]) == 1
    assert any(event["source"] == "REPORTED_COMPLETE" for event in response.data["events"])
    assert any(event["source"] == "REPORTED_VARIANCE" for event in response.data["events"])
    assert response.data["events"][-1]["event_type"] == "DROPOFF"
    assert all(sum(log["totals_minutes"].values()) == 1440 for log in response.data["daily_logs"])


def test_replan_rejects_unknown_or_expired_plan(client):
    response = client.post(
        reverse("trip-replan"),
        {
            "plan_id": "plan-does-not-exist",
            "last_completed_event_id": "event-001",
            "checkpoint_at": "2026-10-05T12:00:00-05:00",
            "current_location": "Denver, CO",
        },
        format="json",
    )
    assert response.status_code == 404
    assert response.data["error"]["code"] == "PLAN_NOT_FOUND"


def test_replan_before_pickup_routes_through_pickup_and_keeps_single_dropoff(client):
    plan = client.post(
        reverse("trip-plan"),
        {
            "current_location": "Chicago, IL",
            "pickup_location": "Denver, CO",
            "dropoff_location": "Los Angeles, CA",
            "current_cycle_used_hours": 0,
            "start_at": "2026-10-05T06:00:00-05:00",
            "terminal_timezone": "America/Chicago",
            "demo_mode": True,
        },
        format="json",
    ).data
    completed = plan["events"][0]
    response = client.post(
        reverse("trip-replan"),
        {
            "plan_id": plan["plan_id"],
            "last_completed_event_id": completed["id"],
            "checkpoint_at": completed["end_at"],
            "current_location": "Chicago, IL",
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert len(response.data["route_legs"]) == 2
    assert sum(event["event_type"] == "PICKUP" for event in response.data["events"]) == 1
    assert sum(event["event_type"] == "DROPOFF" for event in response.data["events"]) == 1


@pytest.mark.parametrize("selection", ["missing", "dropoff", "early"])
def test_replan_rejects_invalid_progress_boundaries(client, selection):
    plan = client.post(
        reverse("trip-plan"),
        {
            "current_location": "Chicago, IL",
            "pickup_location": "Denver, CO",
            "dropoff_location": "Los Angeles, CA",
            "current_cycle_used_hours": 0,
            "start_at": "2026-10-05T06:00:00-05:00",
            "terminal_timezone": "America/Chicago",
            "demo_mode": True,
        },
        format="json",
    ).data
    selected = plan["events"][0]
    event_id = selected["id"]
    checkpoint = selected["end_at"]
    if selection == "missing":
        event_id = "event-missing"
    elif selection == "dropoff":
        selected = plan["events"][-1]
        event_id = selected["id"]
        checkpoint = selected["end_at"]
    else:
        checkpoint = (datetime.fromisoformat(checkpoint) - timedelta(minutes=1)).isoformat()

    response = client.post(
        reverse("trip-replan"),
        {
            "plan_id": plan["plan_id"],
            "last_completed_event_id": event_id,
            "checkpoint_at": checkpoint,
            "current_location": "Chicago, IL",
        },
        format="json",
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "REPLAN_VALIDATION_ERROR"


def test_replan_from_exhausted_cycle_starts_with_restart(client):
    plan = client.post(
        reverse("trip-plan"),
        {
            "current_location": "Chicago, IL",
            "pickup_location": "Denver, CO",
            "dropoff_location": "Los Angeles, CA",
            "current_cycle_used_hours": 69.5,
            "start_at": "2026-10-05T06:00:00-05:00",
            "terminal_timezone": "America/Chicago",
            "demo_mode": True,
        },
        format="json",
    ).data
    completed = plan["events"][0]
    response = client.post(
        reverse("trip-replan"),
        {
            "plan_id": plan["plan_id"],
            "last_completed_event_id": completed["id"],
            "checkpoint_at": completed["end_at"],
            "current_location": "Chicago, IL",
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    first_projected = next(event for event in response.data["events"] if event["source"] == "PROJECTED")
    assert first_projected["event_type"] == "CYCLE_RESTART_34_HOUR"
