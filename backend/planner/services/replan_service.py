from dataclasses import asdict
from datetime import datetime
from uuid import uuid4

from planner.domain.enums import DutyStatus, EventType
from planner.domain.models import Coordinate, ScheduleEvent
from planner.providers.base import RouteProvider
from planner.services.compliance_validator import validate_schedule
from planner.services.daily_log_builder import build_daily_logs, validate_daily_logs
from planner.services.hos_scheduler import schedule_trip
from planner.services.hos_state import derive_hos_state
from planner.services.route_progress import RouteProgress
from planner.services.trip_planner import ASSUMPTIONS, TripPlanningService


class ReplanInputError(ValueError):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.field = field


class TripReplanningService:
    def __init__(self, provider: RouteProvider):
        self.provider = provider

    def replan(self, context: dict, data: dict) -> dict:
        original = context["plan"]
        original_request = context["request"]
        selected_index = next(
            (index for index, event in enumerate(original["events"]) if event["id"] == data["last_completed_event_id"]),
            None,
        )
        if selected_index is None:
            raise ReplanInputError("Select an event from the referenced plan.", "last_completed_event_id")

        selected = original["events"][selected_index]
        if selected["event_type"] == EventType.DROPOFF:
            raise ReplanInputError("A completed trip cannot be replanned.", "last_completed_event_id")
        planned_end = datetime.fromisoformat(selected["end_at"])
        checkpoint = data["checkpoint_at"]
        if checkpoint < planned_end:
            raise ReplanInputError(
                "The reported checkpoint cannot be earlier than the selected event's planned end.",
                "checkpoint_at",
            )

        delay_minutes = round((checkpoint - planned_end).total_seconds() / 60)
        if delay_minutes > 0 and not data.get("delay_duty_status"):
            raise ReplanInputError("Classify the unplanned time before replanning.", "delay_duty_status")

        location_keys = ["current_location", "pickup_location", "dropoff_location"]
        queries = {
            "current_location": data["current_location"],
            "pickup_location": original_request["pickup_location"],
            "dropoff_location": original_request["dropoff_location"],
        }
        locations = {key: self.provider.geocode(queries[key]) for key in location_keys}

        completed = [self._event_from_dict(value) for value in original["events"][: selected_index + 1]]
        for index, event in enumerate(completed, start=1):
            event.original_event_id = event.id
            event.id = f"reported-{index:03d}"
            event.source = "REPORTED_COMPLETE"

        if delay_minutes > 0:
            delay_status = DutyStatus(data["delay_duty_status"])
            completed.append(
                ScheduleEvent(
                    id="reported-delay-001",
                    event_type=EventType.REPORTED_DELAY,
                    duty_status=delay_status,
                    start_at=planned_end,
                    end_at=checkpoint,
                    duration_minutes=delay_minutes,
                    route_leg_id=None,
                    route_distance_start_miles=completed[-1].route_distance_end_miles,
                    route_distance_end_miles=completed[-1].route_distance_end_miles,
                    coordinate=locations["current_location"][1],
                    display_location=locations["current_location"][0],
                    reason="Driver-reported variance from the projected schedule",
                    remarks="Driver-reported variance from the projected schedule",
                    counts_toward_cycle=delay_status in {DutyStatus.DRIVING, DutyStatus.ON_DUTY_NOT_DRIVING},
                    source="REPORTED_VARIANCE",
                )
            )

        state = derive_hos_state(
            completed,
            round(float(original_request["current_cycle_used_hours"]) * 60),
            checkpoint,
        )
        pickup_complete = any(event.event_type == EventType.PICKUP for event in completed)
        if pickup_complete:
            route_pairs = [("current_location", "dropoff_location")]
        else:
            route_pairs = [("current_location", "pickup_location"), ("pickup_location", "dropoff_location")]
        legs = [
            self.provider.directions(
                locations[start_key][0],
                locations[start_key][1],
                locations[end_key][0],
                locations[end_key][1],
                f"replan-leg-{index}",
            )
            for index, (start_key, end_key) in enumerate(route_pairs, start=1)
        ]
        projected = schedule_trip(legs, checkpoint, state.cycle_used_minutes, initial_state=state)
        validate_schedule(projected, legs, initial_state=state)

        progress = RouteProgress(legs)
        important = {
            EventType.PICKUP,
            EventType.DROPOFF,
            EventType.FUEL,
            EventType.BREAK_30_MIN,
            EventType.DAILY_REST_10_HOUR,
            EventType.CYCLE_RESTART_34_HOUR,
        }
        projected_stops = []
        for index, event in enumerate(projected, start=1):
            event.id = f"projected-{index:03d}"
            event.source = "PROJECTED"
            event.coordinate = progress.coordinate_at(event.route_distance_end_miles)
            if event.event_type in important:
                try:
                    event.display_location = self.provider.reverse_geocode(event.coordinate)
                except Exception:
                    event.display_location = (
                        f"Approximately {event.route_distance_end_miles:.0f} mi into the remaining trip"
                    )
                projected_stops.append(event)

        events = completed + projected
        metadata = {
            key: original_request.get(key, "")
            for key in (
                "driver_name",
                "carrier_name",
                "main_office_address",
                "vehicle_number",
                "trailer_number",
                "shipping_document_number",
            )
        }
        logs = build_daily_logs(events, original_request["terminal_timezone"], metadata)
        validate_daily_logs(logs)
        ending_state = derive_hos_state(
            events,
            round(float(original_request["current_cycle_used_hours"]) * 60),
            events[-1].end_at,
        )
        total_miles = sum(leg.distance_miles for leg in legs)
        raw_minutes = sum(leg.duration_minutes for leg in legs)
        version = int(original.get("plan_version", 1)) + 1
        return {
            "plan_id": f"plan-{uuid4().hex}",
            "plan_version": version,
            "parent_plan_id": original["plan_id"],
            "demo_mode": bool(original_request.get("demo_mode")),
            "locations": [
                {"role": role, "label": locations[key][0], "coordinate": asdict(locations[key][1])}
                for role, key in zip(("current", "pickup", "dropoff"), location_keys, strict=False)
            ],
            "route_legs": [TripPlanningService._leg_dict(leg) for leg in legs],
            "events": [event.to_dict() for event in events],
            "stops": [event.to_dict() for event in projected_stops],
            "daily_logs": logs,
            "summary": {
                "total_route_miles": round(total_miles, 1),
                "raw_driving_minutes": raw_minutes,
                "planned_elapsed_minutes": round((projected[-1].end_at - checkpoint).total_seconds() / 60),
                "estimated_arrival": projected[-1].end_at.isoformat(),
                "fuel_stops": sum(event.event_type == EventType.FUEL for event in projected),
                "daily_rests": sum(event.event_type == EventType.DAILY_REST_10_HOUR for event in projected),
                "cycle_restarts": sum(event.event_type == EventType.CYCLE_RESTART_34_HOUR for event in projected),
                "log_sheets": len(logs),
                "ending_cycle_used_hours": round(ending_state.cycle_used_minutes / 60, 2),
                "compliance": {
                    "break_8_hour": True,
                    "drive_11_hour": True,
                    "window_14_hour": True,
                    "cycle_70_hour": True,
                },
            },
            "replan": {
                "last_completed_event_id": selected["id"],
                "checkpoint_at": checkpoint.isoformat(),
                "planned_checkpoint_at": planned_end.isoformat(),
                "delay_minutes": delay_minutes,
                "pickup_complete": pickup_complete,
            },
            "assumptions": ASSUMPTIONS
            + [
                f"Logs use {original_request['terminal_timezone']} for calendar-day boundaries.",
                "Completed events and the checkpoint are driver-reported; "
                "remaining events are regenerated projections.",
            ],
            "warnings": [
                "This plan includes driver-reported progress. Verify reported times and duty status "
                "before relying on the projection."
            ],
            "disclaimer": (
                "Projected log for assessment demonstration; not an electronic record of actual duty activity."
            ),
        }

    @staticmethod
    def _event_from_dict(value: dict) -> ScheduleEvent:
        coordinate_value = value.get("coordinate")
        coordinate = Coordinate(**coordinate_value) if coordinate_value else None
        return ScheduleEvent(
            id=value["id"],
            event_type=EventType(value["event_type"]),
            duty_status=DutyStatus(value["duty_status"]),
            start_at=datetime.fromisoformat(value["start_at"]),
            end_at=datetime.fromisoformat(value["end_at"]),
            duration_minutes=value["duration_minutes"],
            route_leg_id=value.get("route_leg_id"),
            route_distance_start_miles=value["route_distance_start_miles"],
            route_distance_end_miles=value["route_distance_end_miles"],
            coordinate=coordinate,
            display_location=value["display_location"],
            reason=value["reason"],
            remarks=value["remarks"],
            counts_toward_cycle=value["counts_toward_cycle"],
            source=value.get("source", "PROJECTED"),
            original_event_id=value.get("original_event_id"),
        )
