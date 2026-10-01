from datetime import datetime, timedelta

from planner.domain.enums import DutyStatus, EventType
from planner.domain.models import ScheduleEvent
from planner.services.hos_state import derive_hos_state

START = datetime.fromisoformat("2026-10-05T06:00:00-05:00")


def event(index, start, minutes, event_type, status, miles=0):
    return ScheduleEvent(
        id=f"event-{index}",
        event_type=event_type,
        duty_status=status,
        start_at=start,
        end_at=start + timedelta(minutes=minutes),
        duration_minutes=minutes,
        route_leg_id=None,
        route_distance_start_miles=0,
        route_distance_end_miles=miles,
        coordinate=None,
        display_location="Test",
        reason="Test",
        remarks="Test",
        counts_toward_cycle=status in {DutyStatus.DRIVING, DutyStatus.ON_DUTY_NOT_DRIVING},
    )


def test_state_replay_applies_30_minute_break_without_resetting_daily_clock():
    drive = event(1, START, 480, EventType.DRIVE, DutyStatus.DRIVING, 400)
    rest = event(2, drive.end_at, 30, EventType.BREAK_30_MIN, DutyStatus.OFF_DUTY)
    final_drive = event(3, rest.end_at, 20, EventType.DRIVE, DutyStatus.DRIVING, 20)

    state = derive_hos_state([drive, rest, final_drive], 60)

    assert state.driving_since_break_minutes == 20
    assert state.driving_since_rest_minutes == 500
    assert state.cycle_used_minutes == 560
    assert state.miles_since_fuel == 420


def test_state_replay_applies_daily_and_cycle_resets():
    drive = event(1, START, 120, EventType.DRIVE, DutyStatus.DRIVING, 100)
    daily = event(2, drive.end_at, 600, EventType.DAILY_REST_10_HOUR, DutyStatus.SLEEPER_BERTH)
    work = event(3, daily.end_at, 30, EventType.REPORTED_DELAY, DutyStatus.ON_DUTY_NOT_DRIVING)
    restart = event(4, work.end_at, 2040, EventType.CYCLE_RESTART_34_HOUR, DutyStatus.OFF_DUTY)

    after_daily = derive_hos_state([drive, daily, work], 69 * 60)
    assert after_daily.driving_since_rest_minutes == 0
    assert after_daily.elapsed_window_minutes == 30
    assert after_daily.cycle_used_minutes == 69 * 60 + 150

    after_restart = derive_hos_state([drive, daily, work, restart], 69 * 60)
    assert after_restart.cycle_used_minutes == 0
    assert after_restart.elapsed_window_minutes == 0
