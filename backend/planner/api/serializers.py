from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.utils.dateparse import parse_datetime
from rest_framework import serializers


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(min_length=3, max_length=240, trim_whitespace=True)
    pickup_location = serializers.CharField(min_length=3, max_length=240, trim_whitespace=True)
    dropoff_location = serializers.CharField(min_length=3, max_length=240, trim_whitespace=True)
    current_cycle_used_hours = serializers.DecimalField(max_digits=4, decimal_places=2, min_value=0, max_value=70)
    start_at = serializers.DateTimeField(required=False)
    terminal_timezone = serializers.CharField(required=False, default=settings.DEFAULT_TERMINAL_TIMEZONE, max_length=64)
    demo_mode = serializers.BooleanField(required=False, default=False)
    driver_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    carrier_name = serializers.CharField(required=False, allow_blank=True, max_length=160)
    main_office_address = serializers.CharField(required=False, allow_blank=True, max_length=240)
    vehicle_number = serializers.CharField(required=False, allow_blank=True, max_length=80)
    trailer_number = serializers.CharField(required=False, allow_blank=True, max_length=80)
    shipping_document_number = serializers.CharField(required=False, allow_blank=True, max_length=80)

    def validate_terminal_timezone(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise serializers.ValidationError("Use a valid IANA timezone such as America/Chicago.") from exc
        return value

    def validate(self, attrs):
        if "start_at" not in attrs:
            attrs["start_at"] = parse_datetime(settings.DEFAULT_TRIP_START)
        if attrs["start_at"].utcoffset() is None:
            raise serializers.ValidationError({"start_at": "Include a UTC offset in the trip start time."})
        return attrs


class AutocompleteQuerySerializer(serializers.Serializer):
    q = serializers.CharField(min_length=3, max_length=120, trim_whitespace=True)
    demo = serializers.BooleanField(required=False, default=False)


class ReverseGeocodeSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    demo = serializers.BooleanField(required=False, default=False)


class ReplanRequestSerializer(serializers.Serializer):
    plan_id = serializers.CharField(min_length=6, max_length=80)
    last_completed_event_id = serializers.CharField(min_length=3, max_length=80)
    checkpoint_at = serializers.DateTimeField()
    current_location = serializers.CharField(min_length=3, max_length=240, trim_whitespace=True)
    delay_duty_status = serializers.ChoiceField(
        choices=("OFF_DUTY", "SLEEPER_BERTH", "DRIVING", "ON_DUTY_NOT_DRIVING"),
        required=False,
        allow_null=True,
    )

    def validate_checkpoint_at(self, value):
        if value.utcoffset() is None:
            raise serializers.ValidationError("Include a UTC offset in the checkpoint time.")
        if value.second or value.microsecond:
            raise serializers.ValidationError("Use a checkpoint aligned to a whole minute.")
        return value


class CoordinateSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class LocationSerializer(serializers.Serializer):
    role = serializers.CharField()
    label = serializers.CharField()
    coordinate = CoordinateSerializer()


class RouteStepSerializer(serializers.Serializer):
    instruction = serializers.CharField()
    distance_miles = serializers.FloatField()
    duration_minutes = serializers.IntegerField()


class RouteLegSerializer(serializers.Serializer):
    id = serializers.CharField()
    start_name = serializers.CharField()
    end_name = serializers.CharField()
    distance_miles = serializers.FloatField()
    duration_minutes = serializers.IntegerField()
    geometry = CoordinateSerializer(many=True)
    steps = RouteStepSerializer(many=True)


class ScheduleEventSerializer(serializers.Serializer):
    id = serializers.CharField()
    event_type = serializers.CharField()
    duty_status = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    duration_minutes = serializers.IntegerField()
    route_leg_id = serializers.CharField(allow_null=True)
    route_distance_start_miles = serializers.FloatField()
    route_distance_end_miles = serializers.FloatField()
    coordinate = CoordinateSerializer(allow_null=True)
    display_location = serializers.CharField()
    reason = serializers.CharField()
    remarks = serializers.CharField()
    counts_toward_cycle = serializers.BooleanField()
    source = serializers.CharField()
    original_event_id = serializers.CharField(allow_null=True)


class LogSegmentSerializer(serializers.Serializer):
    start_minute = serializers.IntegerField()
    end_minute = serializers.IntegerField()
    duty_status = serializers.CharField()
    event_id = serializers.CharField(allow_null=True)
    reason = serializers.CharField()
    location = serializers.CharField()


class LogRemarkSerializer(serializers.Serializer):
    minute = serializers.IntegerField()
    event_id = serializers.CharField(allow_null=True)
    text = serializers.CharField()
    location = serializers.CharField()


class DailyLogSerializer(serializers.Serializer):
    date = serializers.DateField()
    timezone = serializers.CharField()
    segments = LogSegmentSerializer(many=True)
    totals_minutes = serializers.DictField(child=serializers.IntegerField())
    remarks = LogRemarkSerializer(many=True)
    metadata = serializers.DictField(child=serializers.CharField(allow_blank=True))
    total_miles = serializers.FloatField()


class SummarySerializer(serializers.Serializer):
    total_route_miles = serializers.FloatField()
    raw_driving_minutes = serializers.IntegerField()
    planned_elapsed_minutes = serializers.IntegerField()
    estimated_arrival = serializers.DateTimeField()
    fuel_stops = serializers.IntegerField()
    daily_rests = serializers.IntegerField()
    cycle_restarts = serializers.IntegerField()
    log_sheets = serializers.IntegerField()
    ending_cycle_used_hours = serializers.FloatField()
    compliance = serializers.DictField(child=serializers.BooleanField())


class ReplanMetadataSerializer(serializers.Serializer):
    last_completed_event_id = serializers.CharField()
    checkpoint_at = serializers.DateTimeField()
    planned_checkpoint_at = serializers.DateTimeField()
    delay_minutes = serializers.IntegerField()
    pickup_complete = serializers.BooleanField()


class TripPlanResponseSerializer(serializers.Serializer):
    plan_id = serializers.CharField()
    plan_version = serializers.IntegerField()
    parent_plan_id = serializers.CharField(allow_null=True)
    demo_mode = serializers.BooleanField()
    locations = LocationSerializer(many=True)
    route_legs = RouteLegSerializer(many=True)
    events = ScheduleEventSerializer(many=True)
    stops = ScheduleEventSerializer(many=True)
    daily_logs = DailyLogSerializer(many=True)
    summary = SummarySerializer()
    assumptions = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())
    disclaimer = serializers.CharField()


class TripReplanResponseSerializer(TripPlanResponseSerializer):
    replan = ReplanMetadataSerializer()
