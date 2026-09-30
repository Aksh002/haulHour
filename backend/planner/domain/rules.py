from dataclasses import dataclass


@dataclass(frozen=True)
class HosRules:
    break_after_driving_minutes: int = 8 * 60
    break_duration_minutes: int = 30
    daily_driving_limit_minutes: int = 11 * 60
    duty_window_minutes: int = 14 * 60
    daily_rest_minutes: int = 10 * 60
    cycle_limit_minutes: int = 70 * 60
    cycle_restart_minutes: int = 34 * 60
    pickup_minutes: int = 60
    dropoff_minutes: int = 60
    fuel_threshold_miles: float = 900.0
    fuel_minutes: int = 30


@dataclass(frozen=True)
class HosState:
    cycle_used_minutes: int = 0
    driving_since_break_minutes: int = 0
    driving_since_rest_minutes: int = 0
    elapsed_window_minutes: int = 0
    miles_since_fuel: float = 0.0
