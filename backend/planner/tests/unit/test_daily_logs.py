from datetime import datetime

import pytest

from planner.domain.enums import DutyStatus, EventType
from planner.domain.models import Coordinate, RouteLeg, ScheduleEvent
from planner.services.daily_log_builder import build_daily_logs, validate_daily_logs
from planner.services.hos_scheduler import schedule_trip


def test_midnight_split_and_24_hour_totals():
    legs = [
        RouteLeg("leg-1", "A", "B", 500, 600, [Coordinate(0, 0), Coordinate(0, 1)]),
        RouteLeg("leg-2", "B", "C", 500, 600, [Coordinate(0, 1), Coordinate(0, 2)]),
    ]
    events = schedule_trip(legs, datetime.fromisoformat("2026-10-05T18:00:00-05:00"), 0)
    logs = build_daily_logs(events, "America/Chicago")
    validate_daily_logs(logs)
    assert len(logs) >= 2
    assert all(sum(log["totals_minutes"].values()) == 1440 for log in logs)
    assert abs(sum(log["total_miles"] for log in logs) - 1000) < 0.2


def test_sleeper_crossing_midnight_and_metadata_are_preserved():
    start = datetime.fromisoformat("2026-10-05T22:00:00-05:00")
    sleeper = ScheduleEvent(
        id="rest-1",
        event_type=EventType.DAILY_REST_10_HOUR,
        duty_status=DutyStatus.SLEEPER_BERTH,
        start_at=start,
        end_at=start.replace(day=6, hour=8),
        duration_minutes=600,
        route_leg_id="leg-1",
        route_distance_start_miles=100,
        route_distance_end_miles=100,
        coordinate=None,
        display_location="Springfield Rest Area",
        reason="Daily rest",
        remarks="Daily rest",
        counts_toward_cycle=False,
    )
    logs = build_daily_logs([sleeper], "America/Chicago", {"driver_name": "Alex Driver"})
    validate_daily_logs(logs)
    assert len(logs) == 2
    assert logs[0]["totals_minutes"]["SLEEPER_BERTH"] == 120
    assert logs[1]["totals_minutes"]["SLEEPER_BERTH"] == 480
    assert logs[0]["metadata"]["driver_name"] == "Alex Driver"
    assert logs[0]["remarks"][0]["location"] == "Springfield Rest Area"


def test_log_validator_rejects_negative_mileage_and_orphaned_remarks():
    route = [RouteLeg("leg-1", "A", "B", 50, 60, [Coordinate(0, 0), Coordinate(0, 1)])]
    events = schedule_trip(route, datetime.fromisoformat("2026-10-05T06:00:00-05:00"), 0)
    logs = build_daily_logs(events, "America/Chicago")
    logs[0]["total_miles"] = -1
    with pytest.raises(ValueError, match="mileage"):
        validate_daily_logs(logs)

    logs = build_daily_logs(events, "America/Chicago")
    logs[0]["remarks"].append({"minute": 1, "event_id": "missing", "text": "orphan", "location": ""})
    with pytest.raises(ValueError, match="remark"):
        validate_daily_logs(logs)
