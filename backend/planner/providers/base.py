from abc import ABC, abstractmethod
from dataclasses import dataclass

from planner.domain.models import Coordinate, RouteLeg


class RouteProviderError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "ROUTE_PROVIDER_UNAVAILABLE",
        field_errors: dict[str, list[str]] | None = None,
        status_code: int = 503,
    ):
        super().__init__(message)
        self.code = code
        self.field_errors = field_errors or {}
        self.status_code = status_code


class RoutePointNotRoutableError(RouteProviderError):
    def __init__(self, point_index: int):
        super().__init__("A route point is not close enough to an HGV-routable road")
        self.point_index = point_index


@dataclass(frozen=True)
class ReverseGeocodeResult:
    label: str
    country_code: str | None
    is_supported_country: bool


class RouteProvider(ABC):
    def start_request_budget(self, seconds: float) -> None:
        """Optionally constrain all provider calls made for one planning request."""
        return None

    @abstractmethod
    def geocode(self, query: str) -> tuple[str, Coordinate]: ...

    @abstractmethod
    def reverse_geocode_details(self, coordinate: Coordinate) -> ReverseGeocodeResult: ...

    def reverse_geocode(self, coordinate: Coordinate) -> str:
        return self.reverse_geocode_details(coordinate).label

    @abstractmethod
    def autocomplete(self, query: str) -> list[dict]: ...

    @abstractmethod
    def directions(
        self, start_name: str, start: Coordinate, end_name: str, end: Coordinate, leg_id: str
    ) -> RouteLeg: ...
