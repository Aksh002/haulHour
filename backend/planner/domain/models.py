from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any

from .enums import DutyStatus, EventType


@dataclass(frozen=True)
class Coordinate:
    latitude: float
    longitude: float


@dataclass(frozen=True)
class RouteStep:
    instruction: str
    distance_miles: float
    duration_minutes: int


@dataclass(frozen=True)
class RouteLeg:
    id: str
    start_name: str
    end_name: str
    distance_miles: float
    duration_minutes: int
    geometry: list[Coordinate]
    steps: list[RouteStep] = field(default_factory=list)


@dataclass
class ScheduleEvent:
    id: str
    event_type: EventType
    duty_status: DutyStatus
    start_at: datetime
    end_at: datetime
    duration_minutes: int
    route_leg_id: str | None
    route_distance_start_miles: float
    route_distance_end_miles: float
    coordinate: Coordinate | None
    display_location: str
    reason: str
    remarks: str
    counts_toward_cycle: bool
    source: str = "PROJECTED"
    original_event_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["event_type"] = self.event_type.value
        value["duty_status"] = self.duty_status.value
        value["start_at"] = self.start_at.isoformat()
        value["end_at"] = self.end_at.isoformat()
        return value
