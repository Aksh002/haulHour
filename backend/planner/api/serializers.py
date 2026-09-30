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
