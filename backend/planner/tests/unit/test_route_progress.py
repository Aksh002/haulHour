import pytest

from planner.domain.models import Coordinate, RouteLeg
from planner.services.route_progress import RouteProgress


@pytest.fixture
def progress():
    return RouteProgress(
        [
            RouteLeg("leg-1", "A", "B", 100, 120, [Coordinate(0, 0), Coordinate(0, 1)]),
            RouteLeg("leg-2", "B", "C", 100, 120, [Coordinate(0, 1), Coordinate(0, 2)]),
        ]
    )


def test_start_end_and_leg_boundary(progress):
    assert progress.coordinate_at(0) == Coordinate(0, 0)
    assert progress.coordinate_at(100) == Coordinate(0, 1)
    assert progress.coordinate_at(200) == Coordinate(0, 2)


def test_interpolates_between_vertices(progress):
    point = progress.coordinate_at(50)
    assert point.latitude == pytest.approx(0)
    assert point.longitude == pytest.approx(0.5)
