import math
from datetime import datetime, timedelta

from planner.domain.enums import DutyStatus, EventType
from planner.domain.models import RouteLeg, ScheduleEvent
from planner.domain.rules import HosRules, HosState


def schedule_trip(
    legs: list[RouteLeg],
    start_at: datetime,
    current_cycle_used_minutes: int,
    rules: HosRules | None = None,
    initial_state: HosState | None = None,
) -> list[ScheduleEvent]:
    """Create the canonical timeline using integer-minute regulatory clocks."""
    if not legs:
        raise ValueError("At least one route leg is required")
    if start_at.utcoffset() is None:
        raise ValueError("start_at must be timezone-aware")
    rules = rules or HosRules()
    if initial_state is None and not 0 <= current_cycle_used_minutes <= rules.cycle_limit_minutes:
        raise ValueError("current cycle usage must be between 0 and 70 hours")

    state = initial_state or HosState(cycle_used_minutes=current_cycle_used_minutes)
    if min(
        state.cycle_used_minutes,
        state.driving_since_break_minutes,
        state.driving_since_rest_minutes,
        state.elapsed_window_minutes,
    ) < 0 or state.miles_since_fuel < 0:
        raise ValueError("HOS state values cannot be negative")

    events: list[ScheduleEvent] = []
    now = start_at
    window_start = start_at - timedelta(minutes=state.elapsed_window_minutes)
    cycle_used = state.cycle_used_minutes
    driving_since_break = state.driving_since_break_minutes
    driving_since_rest = state.driving_since_rest_minutes
    miles_since_fuel = state.miles_since_fuel
    trip_distance = 0.0
    sequence = 1

    def append_event(
        event_type: EventType,
        status: DutyStatus,
        minutes: int,
        reason: str,
        leg_id: str | None,
        start_miles: float,
        end_miles: float,
        location: str,
    ) -> None:
        nonlocal now, cycle_used, sequence, driving_since_break, window_start
        event = ScheduleEvent(
            id=f"event-{sequence:03d}",
            event_type=event_type,
            duty_status=status,
            start_at=now,
            end_at=now + timedelta(minutes=minutes),
            duration_minutes=minutes,
            route_leg_id=leg_id,
            route_distance_start_miles=round(start_miles, 3),
            route_distance_end_miles=round(end_miles, 3),
            coordinate=None,
            display_location=location,
            reason=reason,
            remarks=reason,
            counts_toward_cycle=status in {DutyStatus.DRIVING, DutyStatus.ON_DUTY_NOT_DRIVING},
        )
        events.append(event)
        now = event.end_at
        sequence += 1
        if event.counts_toward_cycle:
            cycle_used += minutes
        if status != DutyStatus.DRIVING and minutes >= rules.break_duration_minutes:
            driving_since_break = 0

    for leg_index, leg in enumerate(legs):
        remaining_minutes = leg.duration_minutes
        remaining_miles = leg.distance_miles
        leg_distance = 0.0

        while remaining_minutes > 0:
            if cycle_used >= rules.cycle_limit_minutes:
                append_event(
                    EventType.CYCLE_RESTART_34_HOUR,
                    DutyStatus.OFF_DUTY,
                    rules.cycle_restart_minutes,
                    "34-hour restart required before additional driving under the aggregate-cycle assumption",
                    leg.id,
                    trip_distance,
                    trip_distance,
                    f"Approximately {trip_distance:.0f} mi into the trip",
                )
                cycle_used = 0
                driving_since_rest = 0
                driving_since_break = 0
                window_start = now
                continue

            elapsed_window = int((now - window_start).total_seconds() // 60)
            if driving_since_rest >= rules.daily_driving_limit_minutes or elapsed_window >= rules.duty_window_minutes:
                append_event(
                    EventType.DAILY_REST_10_HOUR,
                    DutyStatus.SLEEPER_BERTH,
                    rules.daily_rest_minutes,
                    "10-hour rest resets the 11-hour driving and 14-hour window clocks",
                    leg.id,
                    trip_distance,
                    trip_distance,
                    f"Approximately {trip_distance:.0f} mi into the trip",
                )
                driving_since_rest = 0
                driving_since_break = 0
                window_start = now
                continue

            if miles_since_fuel >= rules.fuel_threshold_miles - 1e-6:
                append_event(
                    EventType.FUEL,
                    DutyStatus.ON_DUTY_NOT_DRIVING,
                    rules.fuel_minutes,
                    "Conservative fuel stop at the 900-mile planning threshold",
                    leg.id,
                    trip_distance,
                    trip_distance,
                    f"Approximately {trip_distance:.0f} mi into the trip",
                )
                miles_since_fuel = 0.0
                continue

            if driving_since_break >= rules.break_after_driving_minutes:
                append_event(
                    EventType.BREAK_30_MIN,
                    DutyStatus.OFF_DUTY,
                    rules.break_duration_minutes,
                    "Required after 8 cumulative driving hours",
                    leg.id,
                    trip_distance,
                    trip_distance,
                    f"Approximately {trip_distance:.0f} mi into the trip",
                )
                continue

            miles_per_minute = remaining_miles / remaining_minutes
            fuel_minutes = math.floor(max(0.0, rules.fuel_threshold_miles - miles_since_fuel) / miles_per_minute + 1e-9)
            if fuel_minutes <= 0:
                append_event(
                    EventType.FUEL,
                    DutyStatus.ON_DUTY_NOT_DRIVING,
                    rules.fuel_minutes,
                    "Conservative fuel stop before the 900-mile planning threshold",
                    leg.id,
                    trip_distance,
                    trip_distance,
                    f"Approximately {trip_distance:.0f} mi into the trip",
                )
                miles_since_fuel = 0.0
                continue
            limits = [
                remaining_minutes,
                rules.break_after_driving_minutes - driving_since_break,
                rules.daily_driving_limit_minutes - driving_since_rest,
                rules.duty_window_minutes - elapsed_window,
                rules.cycle_limit_minutes - cycle_used,
                fuel_minutes,
            ]
            drive_minutes = max(0, min(limits))
            if drive_minutes == 0:
                continue
            drive_miles = remaining_miles if drive_minutes == remaining_minutes else miles_per_minute * drive_minutes
            append_event(
                EventType.DRIVE,
                DutyStatus.DRIVING,
                drive_minutes,
                f"Drive toward {leg.end_name}",
                leg.id,
                trip_distance,
                trip_distance + drive_miles,
                f"{leg.start_name} to {leg.end_name}",
            )
            driving_since_break += drive_minutes
            driving_since_rest += drive_minutes
            miles_since_fuel += drive_miles
            trip_distance += drive_miles
            leg_distance += drive_miles
            remaining_minutes -= drive_minutes
            remaining_miles = max(0.0, leg.distance_miles - leg_distance)

        is_last = leg_index == len(legs) - 1
        append_event(
            EventType.DROPOFF if is_last else EventType.PICKUP,
            DutyStatus.ON_DUTY_NOT_DRIVING,
            rules.dropoff_minutes if is_last else rules.pickup_minutes,
            "One hour of on-duty service at drop-off" if is_last else "One hour of on-duty service at pickup",
            leg.id,
            trip_distance,
            trip_distance,
            leg.end_name,
        )

    return events
