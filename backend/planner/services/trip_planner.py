from dataclasses import asdict
from uuid import uuid4

from planner.domain.enums import EventType
from planner.domain.models import Coordinate
from planner.domain.rules import HosState
from planner.providers.base import RoutePointNotRoutableError, RouteProvider, RouteProviderError
from planner.services.compliance_validator import validate_schedule
from planner.services.daily_log_builder import build_daily_logs, validate_daily_logs
from planner.services.hos_scheduler import schedule_trip
from planner.services.route_progress import RouteProgress

ASSUMPTIONS = [
    "Cycle usage is an aggregate balance from the previous eight days; hours do not roll off individually.",
    "The driver starts after a qualifying 10-hour rest with fresh 11-hour and 14-hour clocks.",
    "OpenRouteService moving duration is used as driving time.",
    "Fuel is planned conservatively at or before 900 route miles.",
    "Split-sleeper and adverse-driving-condition extensions are not modeled.",
]


class TripPlanningService:
    def __init__(self, provider: RouteProvider, provider_budget_seconds: float = 45):
        self.provider = provider
        self.provider_budget_seconds = provider_budget_seconds

    def plan(self, data: dict) -> dict:
        self.provider.start_request_budget(self.provider_budget_seconds)
        location_keys = ["current_location", "pickup_location", "dropoff_location"]
        locations = [self._resolve_location(data, key) for key in location_keys]
        legs = [
            self._route_leg(locations[0], locations[1], "current_location", "pickup_location", "leg-1"),
            self._route_leg(locations[1], locations[2], "pickup_location", "dropoff_location", "leg-2"),
        ]
        events = schedule_trip(
            legs,
            data["start_at"],
            round(float(data["current_cycle_used_hours"]) * 60),
        )
        validate_schedule(
            events,
            legs,
            initial_state=HosState(
                cycle_used_minutes=round(float(data["current_cycle_used_hours"]) * 60),
            ),
        )
        progress = RouteProgress(legs)
        important = {
            EventType.PICKUP,
            EventType.DROPOFF,
            EventType.FUEL,
            EventType.BREAK_30_MIN,
            EventType.DAILY_REST_10_HOUR,
            EventType.CYCLE_RESTART_34_HOUR,
        }
        stops = []
        for event in events:
            event.coordinate = progress.coordinate_at(event.route_distance_end_miles)
            if event.event_type in important:
                try:
                    event.display_location = self.provider.reverse_geocode(event.coordinate)
                except Exception:  # a location label is optional after a successful route
                    event.display_location = f"Approximately {event.route_distance_end_miles:.0f} mi into the trip"
                stops.append(event)
        metadata = {
            key: data.get(key, "")
            for key in (
                "driver_name",
                "carrier_name",
                "main_office_address",
                "vehicle_number",
                "trailer_number",
                "shipping_document_number",
            )
        }
        logs = build_daily_logs(events, data["terminal_timezone"], metadata)
        validate_daily_logs(logs)
        total_miles = sum(leg.distance_miles for leg in legs)
        raw_minutes = sum(leg.duration_minutes for leg in legs)
        ending_cycle_minutes = round(float(data["current_cycle_used_hours"]) * 60)
        for event in events:
            if event.event_type == EventType.CYCLE_RESTART_34_HOUR:
                ending_cycle_minutes = 0
            elif event.counts_toward_cycle:
                ending_cycle_minutes += event.duration_minutes
        restart_count = sum(event.event_type == EventType.CYCLE_RESTART_34_HOUR for event in events)
        return {
            "plan_id": f"plan-{uuid4().hex}",
            "plan_version": 1,
            "parent_plan_id": None,
            "demo_mode": bool(data.get("demo_mode")),
            "locations": [
                {"role": role, "label": label, "coordinate": asdict(coordinate)}
                for role, (label, coordinate) in zip(("current", "pickup", "dropoff"), locations, strict=False)
            ],
            "route_legs": [self._leg_dict(leg) for leg in legs],
            "events": [event.to_dict() for event in events],
            "stops": [event.to_dict() for event in stops],
            "daily_logs": logs,
            "summary": {
                "total_route_miles": round(total_miles, 1),
                "raw_driving_minutes": raw_minutes,
                "planned_elapsed_minutes": round((events[-1].end_at - events[0].start_at).total_seconds() / 60),
                "estimated_arrival": events[-1].end_at.isoformat(),
                "fuel_stops": sum(event.event_type == EventType.FUEL for event in events),
                "daily_rests": sum(event.event_type == EventType.DAILY_REST_10_HOUR for event in events),
                "cycle_restarts": restart_count,
                "log_sheets": len(logs),
                "ending_cycle_used_hours": round(ending_cycle_minutes / 60, 2),
                "compliance": {
                    "break_8_hour": True,
                    "drive_11_hour": True,
                    "window_14_hour": True,
                    "cycle_70_hour": True,
                },
            },
            "assumptions": ASSUMPTIONS + [f"Logs use {data['terminal_timezone']} for calendar-day boundaries."],
            "warnings": ["Demo fixture selected; route geometry and directions are deterministic sample data."]
            if data.get("demo_mode")
            else [],
            "disclaimer": (
                "Projected log for assessment demonstration; not an electronic record of actual duty activity."
            ),
        }

    def _resolve_location(self, data: dict, location_key: str) -> tuple[str, Coordinate]:
        coordinate_data = data.get(f"{location_key}_coordinate")
        if not coordinate_data:
            return self.provider.geocode(data[location_key])
        coordinate = Coordinate(coordinate_data["latitude"], coordinate_data["longitude"])
        details = self.provider.reverse_geocode_details(coordinate)
        if not details.is_supported_country:
            message = "Choose a location within the supported United States service area."
            raise RouteProviderError(
                message,
                code="LOCATION_OUTSIDE_US",
                field_errors={location_key: [message]},
                status_code=422,
            )
        return data[location_key], coordinate

    def _route_leg(
        self,
        start: tuple[str, Coordinate],
        end: tuple[str, Coordinate],
        start_field: str,
        end_field: str,
        leg_id: str,
    ):
        try:
            return self.provider.directions(start[0], start[1], end[0], end[1], leg_id)
        except RoutePointNotRoutableError as exc:
            field = start_field if exc.point_index == 0 else end_field
            label = start[0] if exc.point_index == 0 else end[0]
            detail = "Move the pin to a truck-accessible road or choose a more precise facility entrance."
            raise RouteProviderError(
                f"{label} is not close enough to an HGV-routable road. {detail}",
                code="ROUTE_POINT_NOT_ROUTABLE",
                field_errors={field: [detail]},
                status_code=422,
            ) from exc

    @staticmethod
    def _leg_dict(leg):
        return {
            "id": leg.id,
            "start_name": leg.start_name,
            "end_name": leg.end_name,
            "distance_miles": round(leg.distance_miles, 1),
            "duration_minutes": leg.duration_minutes,
            "geometry": [asdict(point) for point in leg.geometry],
            "steps": [asdict(step) for step in leg.steps],
        }
