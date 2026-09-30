from abc import ABC, abstractmethod
from dataclasses import dataclass

from planner.domain.models import Coordinate, RouteLeg


class RouteProviderError(RuntimeError):
    code = "ROUTE_PROVIDER_UNAVAILABLE"


@dataclass(frozen=True)
class ReverseGeocodeResult:
    label: str
    country_code: str | None
    is_supported_country: bool


class RouteProvider(ABC):
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
