from planner.domain.models import Coordinate, RouteLeg, RouteStep
from planner.providers.base import ReverseGeocodeResult, RouteProvider

DEMO_LOCATIONS = {
    "Chicago, IL": Coordinate(41.8781, -87.6298),
    "Denver, CO": Coordinate(39.7392, -104.9903),
    "Los Angeles, CA": Coordinate(34.0522, -118.2437),
}


class DemoRouteProvider(RouteProvider):
    def geocode(self, query: str):
        if query not in DEMO_LOCATIONS:
            raise ValueError("Demo mode supports Chicago, Denver, and Los Angeles")
        return query, DEMO_LOCATIONS[query]

    def reverse_geocode_details(self, coordinate: Coordinate) -> ReverseGeocodeResult:
        for name, point in DEMO_LOCATIONS.items():
            if coordinate == point:
                return ReverseGeocodeResult(name, "USA", True)
        return ReverseGeocodeResult("Demo route stop", "USA", True)

    def autocomplete(self, query: str) -> list[dict]:
        return [
            {"label": name, "coordinate": {"latitude": point.latitude, "longitude": point.longitude}}
            for name, point in DEMO_LOCATIONS.items()
            if query.casefold() in name.casefold()
        ]

    def directions(self, start_name, start, end_name, end, leg_id):
        key = (start_name, end_name)
        details = {
            ("Chicago, IL", "Denver, CO"): (1004.0, 960),
            ("Denver, CO", "Los Angeles, CA"): (1016.0, 990),
        }
        distance, duration = details[key]
        midpoint = Coordinate((start.latitude + end.latitude) / 2, (start.longitude + end.longitude) / 2)
        return RouteLeg(
            id=leg_id,
            start_name=start_name,
            end_name=end_name,
            distance_miles=distance,
            duration_minutes=duration,
            geometry=[start, midpoint, end],
            steps=[RouteStep(f"Follow the demo route toward {end_name}", distance, duration)],
        )
