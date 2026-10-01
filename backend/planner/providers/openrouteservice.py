import logging
import re
import time

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from planner.domain.models import Coordinate, RouteLeg, RouteStep
from planner.providers.base import (
    ReverseGeocodeResult,
    RoutePointNotRoutableError,
    RouteProvider,
    RouteProviderError,
)

BASE_URL = "https://api.openrouteservice.org"
logger = logging.getLogger("haulhour.provider")


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
        self.deadline: float | None = None

    def start_request_budget(self, seconds: float) -> None:
        self.deadline = time.monotonic() + seconds

    def _timeout(self, maximum_read_seconds: float) -> tuple[float, float]:
        if self.deadline is None:
            return 3.05, maximum_read_seconds
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise RouteProviderError("The route provider exceeded the planning time budget")
        return min(3.05, remaining), min(maximum_read_seconds, remaining)

    def _get(self, path: str, params: dict):
        started = time.monotonic()
        outcome = "error"
        try:
            response = self.session.get(
                f"{BASE_URL}{path}",
                params={**params, "api_key": self.api_key},
                timeout=self._timeout(15),
            )
            response.raise_for_status()
            outcome = "success"
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            raise RouteProviderError("The route provider could not complete the request") from exc
        finally:
            logger.info(
                "provider_request",
                extra={
                    "operation": path.rsplit("/", 1)[-1],
                    "outcome": outcome,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                },
            )

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
        started = time.monotonic()
        outcome = "error"
        try:
            response = self.session.post(
                f"{BASE_URL}/v2/directions/driving-hgv/geojson",
                headers={"Authorization": self.api_key, "Content-Type": "application/json"},
                json={
                    "coordinates": [[start.longitude, start.latitude], [end.longitude, end.latitude]],
                    "instructions": True,
                    "radiuses": [settings.ROUTING_SNAP_RADIUS_METERS, settings.ROUTING_SNAP_RADIUS_METERS],
                },
                timeout=self._timeout(25),
            )
            if response.status_code == 404:
                try:
                    provider_error = response.json().get("error", {})
                except ValueError:
                    provider_error = {}
                if provider_error.get("code") == 2010:
                    match = re.search(r"coordinate\s+([01])", str(provider_error.get("message", "")))
                    if match:
                        outcome = "point_not_routable"
                        raise RoutePointNotRoutableError(int(match.group(1)))
            response.raise_for_status()
            feature = response.json()["features"][0]
            outcome = "success"
        except RoutePointNotRoutableError:
            raise
        except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
            raise RouteProviderError("The road route could not be calculated right now") from exc
        finally:
            logger.info(
                "provider_request",
                extra={
                    "operation": "directions",
                    "outcome": outcome,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                },
            )
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
