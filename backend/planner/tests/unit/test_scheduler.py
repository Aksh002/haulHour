from datetime import datetime

import pytest

from planner.domain.enums import EventType
from planner.domain.models import Coordinate, RouteLeg
from planner.domain.rules import HosState
from planner.services.compliance_validator import ScheduleInvariantError, validate_schedule
from planner.services.hos_scheduler import schedule_trip

START = datetime.fromisoformat("2026-10-05T06:00:00-05:00")


def legs(minutes=(120, 120), miles=(100, 100)):
    return [
        RouteLeg("leg-1", "A", "B", miles[0], minutes[0], [Coordinate(0, 0), Coordinate(0, 1)]),
        RouteLeg("leg-2", "B", "C", miles[1], minutes[1], [Coordinate(0, 1), Coordinate(0, 2)]),
    ]


def test_short_trip_has_exact_pickup_and_dropoff():
    route = legs()
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    assert [e.event_type for e in events] == [EventType.DRIVE, EventType.PICKUP, EventType.DRIVE, EventType.DROPOFF]
    assert events[1].duration_minutes == events[-1].duration_minutes == 60


def test_exactly_eight_hours_requires_break_before_more_driving():
    route = legs((120, 540), (100, 450))
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    assert EventType.BREAK_30_MIN in [e.event_type for e in events]


def test_pickup_after_seven_and_half_hours_satisfies_break():
    route = legs((450, 60), (400, 50))
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    assert EventType.BREAK_30_MIN not in [e.event_type for e in events]


def test_eleven_hour_boundary_adds_daily_rest():
    route = legs((660, 60), (600, 50))
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    assert EventType.DAILY_REST_10_HOUR in [e.event_type for e in events]


def test_fourteen_hour_window_adds_rest_before_daily_driving_limit():
    route = legs((600, 60), (10_000, 50))
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    rest_index = next(index for index, event in enumerate(events) if event.event_type == EventType.DAILY_REST_10_HOUR)
    rest = events[rest_index]
    assert sum(event.duration_minutes for event in events[:rest_index] if event.event_type == EventType.DRIVE) < 660
    assert round((rest.start_at - START).total_seconds() / 60) == 840


def test_pickup_can_consume_last_cycle_hour_before_restart():
    route = legs((60, 60), (50, 50))
    events = schedule_trip(route, START, 68 * 60)
    validate_schedule(events, route, initial_state=HosState(cycle_used_minutes=68 * 60))
    assert [event.event_type for event in events[:3]] == [
        EventType.DRIVE,
        EventType.PICKUP,
        EventType.CYCLE_RESTART_34_HOUR,
    ]


def test_long_trip_requires_daily_rest_and_cycle_restart():
    route = legs((700, 700), (800, 800))
    events = schedule_trip(route, START, 60 * 60)
    validate_schedule(events, route, initial_state=HosState(cycle_used_minutes=60 * 60))
    event_types = [event.event_type for event in events]
    assert EventType.DAILY_REST_10_HOUR in event_types
    assert EventType.CYCLE_RESTART_34_HOUR in event_types


@pytest.mark.parametrize("miles,expected", [((600, 500), 1), ((1100, 1100), 2)])
def test_fuel_threshold(miles, expected):
    route = legs((600, 600), miles)
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    assert sum(e.event_type == EventType.FUEL for e in events) == expected


def test_nearly_exhausted_cycle_adds_restart():
    route = legs((60, 60), (50, 50))
    events = schedule_trip(route, START, 69 * 60 + 30)
    validate_schedule(events, route, initial_state=HosState(cycle_used_minutes=69 * 60 + 30))
    assert EventType.CYCLE_RESTART_34_HOUR in [e.event_type for e in events]


def test_exact_900_miles_schedules_fuel_only_before_additional_driving():
    route = legs((450, 451), (450, 451))
    events = schedule_trip(route, START, 0)
    validate_schedule(events, route)
    fuel = next(event for event in events if event.event_type == EventType.FUEL)
    assert fuel.route_distance_start_miles == pytest.approx(900)


def test_resumed_state_observes_existing_daily_driving_clock():
    route = legs()
    state = HosState(
        cycle_used_minutes=20 * 60,
        driving_since_break_minutes=7 * 60,
        driving_since_rest_minutes=10 * 60,
        elapsed_window_minutes=12 * 60,
    )
    events = schedule_trip(route, START, state.cycle_used_minutes, initial_state=state)
    validate_schedule(events, route, initial_state=state)
    first_drive = next(event for event in events if event.event_type == EventType.DRIVE)
    assert first_drive.duration_minutes == 60
    assert events[1].event_type == EventType.DAILY_REST_10_HOUR


def test_deterministic_and_corruption_is_rejected():
    route = legs((700, 700), (800, 800))
    first = schedule_trip(route, START, 0)
    second = schedule_trip(route, START, 0)
    assert [e.to_dict() for e in first] == [e.to_dict() for e in second]
    first[0].duration_minutes = 1
    with pytest.raises(ScheduleInvariantError):
        validate_schedule(first, route)
