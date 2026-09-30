from datetime import timedelta

from planner.domain.enums import DutyStatus, EventType
from planner.domain.models import RouteLeg, ScheduleEvent
from planner.domain.rules import HosRules, HosState


class ScheduleInvariantError(ValueError):
    pass


def validate_schedule(
    events: list[ScheduleEvent],
    legs: list[RouteLeg],
    rules: HosRules | None = None,
    initial_state: HosState | None = None,
) -> None:
    rules = rules or HosRules()
    if not events:
        raise ScheduleInvariantError("schedule is empty")
    for previous, event in zip(events, events[1:], strict=False):
        if previous.end_at > event.start_at:
            raise ScheduleInvariantError("events overlap")
    if any(event.duration_minutes <= 0 or event.start_at >= event.end_at for event in events):
        raise ScheduleInvariantError("events must have positive duration")
    drives = [event for event in events if event.event_type == EventType.DRIVE]
    expected_minutes = sum(leg.duration_minutes for leg in legs)
    expected_miles = sum(leg.distance_miles for leg in legs)
    if sum(event.duration_minutes for event in drives) != expected_minutes:
        raise ScheduleInvariantError("driving duration does not match route")
    if (
        abs(sum(event.route_distance_end_miles - event.route_distance_start_miles for event in drives) - expected_miles)
        > 0.1
    ):
        raise ScheduleInvariantError("driving distance does not match route")
    pickup = [event for event in events if event.event_type == EventType.PICKUP]
    dropoff = [event for event in events if event.event_type == EventType.DROPOFF]
    if len(pickup) != max(0, len(legs) - 1) or len(dropoff) != 1:
        raise ScheduleInvariantError("pickup/drop-off count is invalid")
    if any(event.duration_minutes != 60 for event in pickup + dropoff):
        raise ScheduleInvariantError("pickup and drop-off must last one hour")

    state = initial_state or HosState()
    driving_since_break = state.driving_since_break_minutes
    driving_since_rest = state.driving_since_rest_minutes
    cycle = state.cycle_used_minutes
    window_start = events[0].start_at - timedelta(minutes=state.elapsed_window_minutes)
    for event in events:
        if event.event_type == EventType.CYCLE_RESTART_34_HOUR:
            cycle = driving_since_break = driving_since_rest = 0
            window_start = event.end_at
        elif event.event_type == EventType.DAILY_REST_10_HOUR:
            driving_since_break = driving_since_rest = 0
            window_start = event.end_at
        elif event.duty_status != DutyStatus.DRIVING and event.duration_minutes >= 30:
            driving_since_break = 0
        if event.duty_status == DutyStatus.DRIVING:
            if cycle >= rules.cycle_limit_minutes:
                raise ScheduleInvariantError("driving occurred after cycle limit")
            if driving_since_break + event.duration_minutes > rules.break_after_driving_minutes:
                raise ScheduleInvariantError("8-hour break rule exceeded")
            if driving_since_rest + event.duration_minutes > rules.daily_driving_limit_minutes:
                raise ScheduleInvariantError("11-hour driving limit exceeded")
            if int((event.end_at - window_start).total_seconds() // 60) > rules.duty_window_minutes:
                raise ScheduleInvariantError("14-hour window exceeded")
            driving_since_break += event.duration_minutes
            driving_since_rest += event.duration_minutes
        if event.counts_toward_cycle:
            cycle += event.duration_minutes
