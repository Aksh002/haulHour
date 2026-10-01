import pytest
import responses

from planner.domain.models import Coordinate
from planner.providers.base import RoutePointNotRoutableError, RouteProviderError
from planner.providers.openrouteservice import OpenRouteServiceProvider


@responses.activate
def test_geocode_and_hgv_directions_are_normalized():
    responses.get(
        "https://api.openrouteservice.org/geocode/search",
        json={
            "features": [
                {
                    "geometry": {"coordinates": [-87.6298, 41.8781]},
                    "properties": {"label": "Chicago, Illinois, USA"},
                }
            ]
        },
        status=200,
    )
    responses.post(
        "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson",
        json={
            "features": [
                {
                    "geometry": {"coordinates": [[-87.6298, 41.8781], [-104.9903, 39.7392]]},
                    "properties": {
                        "summary": {"distance": 1_609_344, "duration": 57_600},
                        "segments": [
                            {
                                "steps": [
                                    {
                                        "instruction": "Continue west",
                                        "distance": 1_609_344,
                                        "duration": 57_600,
                                    }
                                ]
                            }
                        ],
                    },
                }
            ]
        },
        status=200,
    )
    provider = OpenRouteServiceProvider("server-only-test-key")
    label, chicago = provider.geocode("Chicago")
    leg = provider.directions(
        label,
        chicago,
        "Denver",
        Coordinate(39.7392, -104.9903),
        "leg-1",
    )
    assert label == "Chicago, Illinois, USA"
    assert leg.distance_miles == 1000
    assert leg.duration_minutes == 960
    assert leg.geometry[-1] == Coordinate(39.7392, -104.9903)
    assert "server-only-test-key" not in repr(leg)


@responses.activate
def test_reverse_geocode_identifies_supported_country():
    responses.get(
        "https://api.openrouteservice.org/geocode/reverse",
        json={
            "features": [
                {
                    "properties": {
                        "label": "Washington Dulles International Airport, Virginia, USA",
                        "country_a": "USA",
                    }
                }
            ]
        },
        status=200,
    )
    result = OpenRouteServiceProvider("server-only-test-key").reverse_geocode_details(Coordinate(38.9531, -77.4565))
    assert result.is_supported_country is True
    assert result.country_code == "USA"


@responses.activate
def test_reverse_geocode_identifies_location_outside_us():
    responses.get(
        "https://api.openrouteservice.org/geocode/reverse",
        json={
            "features": [
                {
                    "properties": {
                        "label": "New Delhi, India",
                        "country_a": "IND",
                    }
                }
            ]
        },
        status=200,
    )
    result = OpenRouteServiceProvider("server-only-test-key").reverse_geocode_details(Coordinate(28.6139, 77.2090))
    assert result.is_supported_country is False
    assert result.country_code == "IND"


def test_provider_rejects_calls_after_overall_budget_is_exhausted():
    provider = OpenRouteServiceProvider("server-only-test-key")
    provider.start_request_budget(0)
    with pytest.raises(RouteProviderError, match="time budget"):
        provider.geocode("Chicago")


@responses.activate
def test_directions_exposes_the_unroutable_endpoint():
    responses.post(
        "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson",
        json={
            "error": {
                "code": 2010,
                "message": "Could not find routable point within a radius of 1500.0 meters of specified coordinate 1",
            }
        },
        status=404,
    )
    provider = OpenRouteServiceProvider("server-only-test-key")
    with pytest.raises(RoutePointNotRoutableError) as captured:
        provider.directions(
            "Pickup",
            Coordinate(39.436406, -84.115785),
            "Rural drop-off",
            Coordinate(39.432737, -103.136157),
            "leg-2",
        )
    assert captured.value.point_index == 1
