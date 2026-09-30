import math

from planner.domain.models import Coordinate, RouteLeg

EARTH_RADIUS_MILES = 3958.8


def _distance(a: Coordinate, b: Coordinate) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat = lat2 - lat1
    dlon = math.radians(b.longitude - a.longitude)
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(value))


class RouteProgress:
    def __init__(self, legs: list[RouteLeg]):
        self.legs = legs
        self.offsets: dict[str, float] = {}
        offset = 0.0
        for leg in legs:
            self.offsets[leg.id] = offset
            offset += leg.distance_miles
        self.total_miles = offset

    def coordinate_at(self, absolute_miles: float) -> Coordinate:
        target = min(max(0.0, absolute_miles), self.total_miles)
        leg = self.legs[-1]
        for candidate in self.legs:
            if target <= self.offsets[candidate.id] + candidate.distance_miles + 1e-9:
                leg = candidate
                break
        return self.coordinate_in_leg(leg.id, target - self.offsets[leg.id])

    def coordinate_in_leg(self, leg_id: str, miles: float) -> Coordinate:
        leg = next(item for item in self.legs if item.id == leg_id)
        if not leg.geometry:
            raise ValueError("Route leg geometry is empty")
        if miles <= 0:
            return leg.geometry[0]
        if miles >= leg.distance_miles:
            return leg.geometry[-1]
        geometry_lengths = [_distance(a, b) for a, b in zip(leg.geometry, leg.geometry[1:], strict=False)]
        geometry_total = sum(geometry_lengths)
        target = (miles / leg.distance_miles) * geometry_total
        covered = 0.0
        for index, segment in enumerate(geometry_lengths):
            if covered + segment >= target:
                ratio = 0.0 if segment == 0 else (target - covered) / segment
                start, end = leg.geometry[index], leg.geometry[index + 1]
                return Coordinate(
                    latitude=start.latitude + (end.latitude - start.latitude) * ratio,
                    longitude=start.longitude + (end.longitude - start.longitude) * ratio,
                )
            covered += segment
        return leg.geometry[-1]

    def coordinate_at_leg_fraction(self, leg_id: str, fraction: float) -> Coordinate:
        leg = next(item for item in self.legs if item.id == leg_id)
        return self.coordinate_in_leg(leg_id, leg.distance_miles * min(max(fraction, 0.0), 1.0))
