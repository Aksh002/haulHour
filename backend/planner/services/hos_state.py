from datetime import datetime

from planner.domain.enums import DutyStatus, EventType
from planner.domain.models import ScheduleEvent
from planner.domain.rules import HosRules, HosState


def derive_hos_state(
    events: list[ScheduleEvent],
    initial_cycle_used_minutes: int,
    at: datetime | None = None,
    rules: HosRules | None = None,
) -> HosState:
    """Replay reported/completed events into the state consumed by the scheduler."""
    rules = rules or HosRules()
    if not events:
        return HosState(cycle_used_minutes=initial_cycle_used_minutes)

    cycle = initial_cycle_used_minutes
    driving_since_break = 0
    driving_since_rest = 0
    miles_since_fuel = 0.0
    window_start = events[0].start_at

    for event in events:
        if event.event_type == EventType.CYCLE_RESTART_34_HOUR or (
            event.duty_status in {DutyStatus.OFF_DUTY, DutyStatus.SLEEPER_BERTH}
            and event.duration_minutes >= rules.cycle_restart_minutes
        ):
            cycle = 0
            driving_since_break = 0
            driving_since_rest = 0
            window_start = event.end_at
            continue

        if event.event_type == EventType.DAILY_REST_10_HOUR or (
            event.duty_status in {DutyStatus.OFF_DUTY, DutyStatus.SLEEPER_BERTH}
            and event.duration_minutes >= rules.daily_rest_minutes
        ):
            driving_since_break = 0
            driving_since_rest = 0
            window_start = event.end_at
        elif event.duty_status != DutyStatus.DRIVING and event.duration_minutes >= rules.break_duration_minutes:
            driving_since_break = 0

        if event.duty_status == DutyStatus.DRIVING:
            driving_since_break += event.duration_minutes
            driving_since_rest += event.duration_minutes
            miles_since_fuel += event.route_distance_end_miles - event.route_distance_start_miles
        elif event.event_type == EventType.FUEL:
            miles_since_fuel = 0.0

        if event.counts_toward_cycle:
            cycle += event.duration_minutes

    checkpoint = at or events[-1].end_at
    return HosState(
        cycle_used_minutes=cycle,
        driving_since_break_minutes=driving_since_break,
        driving_since_rest_minutes=driving_since_rest,
        elapsed_window_minutes=max(0, round((checkpoint - window_start).total_seconds() / 60)),
        miles_since_fuel=max(0.0, miles_since_fuel),
    )
