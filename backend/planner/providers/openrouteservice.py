import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from planner.domain.models import Coordinate, RouteLeg, RouteStep
from planner.providers.base import ReverseGeocodeResult, RouteProvider, RouteProviderError

BASE_URL = "https://api.openrouteservice.org"


class OpenRouteServiceProvider(RouteProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.OPENROUTESERVICE_API_KEY
        if not self.api_key:
            raise RouteProviderError("OpenRouteService is not configured")
        retry = Retry(
            total=2,
            backoff_factor=0.25,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET", "POST"),
            raise_on_status=False,
        )
        self.session = requests.Session()
        self.session.mount("https://", HTTPAdapter(max_retries=retry))

    def _get(self, path: str, params: dict):
        try:
            response = self.session.get(
                f"{BASE_URL}{path}",
                params={**params, "api_key": self.api_key},
                timeout=(3.05, 15),
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            raise RouteProviderError("The route provider could not complete the request") from exc

    def geocode(self, query: str):
        data = self._get("/geocode/search", {"text": query, "size": 1, "boundary.country": "US"})
        if not data.get("features"):
            raise RouteProviderError(f"No location could be found for {query}")
        feature = data["features"][0]
        lon, lat = feature["geometry"]["coordinates"]
        return feature["properties"].get("label", query), Coordinate(lat, lon)

    def reverse_geocode_details(self, coordinate: Coordinate) -> ReverseGeocodeResult:
        data = self._get(
            "/geocode/reverse",
            {"point.lat": coordinate.latitude, "point.lon": coordinate.longitude, "size": 1},
        )
        features = data.get("features", [])
        if not features:
            raise RouteProviderError("No address could be found at that map position")
        properties = features[0]["properties"]
        country_code = properties.get("country_a") or properties.get("country_code")
        normalized_code = str(country_code).upper() if country_code else None
        return ReverseGeocodeResult(
            label=properties.get("label", "Route stop"),
            country_code=normalized_code,
            is_supported_country=normalized_code in {"US", "USA"},
        )

    def autocomplete(self, query: str) -> list[dict]:
        data = self._get("/geocode/autocomplete", {"text": query, "size": 5, "boundary.country": "US"})
        result = []
        for feature in data.get("features", []):
            lon, lat = feature["geometry"]["coordinates"]
            result.append(
                {
                    "label": feature["properties"].get("label", query),
                    "coordinate": {"latitude": lat, "longitude": lon},
                }
            )
        return result

    def directions(self, start_name, start, end_name, end, leg_id):
        try:
            response = self.session.post(
                f"{BASE_URL}/v2/directions/driving-hgv/geojson",
                headers={"Authorization": self.api_key, "Content-Type": "application/json"},
                json={
                    "coordinates": [[start.longitude, start.latitude], [end.longitude, end.latitude]],
                    "instructions": True,
                },
                timeout=(3.05, 25),
            )
            response.raise_for_status()
            feature = response.json()["features"][0]
        except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
            raise RouteProviderError("The road route could not be calculated right now") from exc
        summary = feature["properties"]["summary"]
        coordinates = [Coordinate(lat, lon) for lon, lat in feature["geometry"]["coordinates"]]
        steps = [
            RouteStep(
                instruction=step["instruction"],
                distance_miles=step["distance"] / 1609.344,
                duration_minutes=round(step["duration"] / 60),
            )
            for segment in feature["properties"].get("segments", [])
            for step in segment.get("steps", [])
        ]
        return RouteLeg(
            id=leg_id,
            start_name=start_name,
            end_name=end_name,
            distance_miles=summary["distance"] / 1609.344,
            duration_minutes=max(1, round(summary["duration"] / 60)),
            geometry=coordinates,
            steps=steps,
        )
