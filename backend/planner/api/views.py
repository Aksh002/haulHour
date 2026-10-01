import hashlib
import json

from django.conf import settings
from django.core.cache import cache
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from planner.api.serializers import (
    AutocompleteQuerySerializer,
    ReplanRequestSerializer,
    ReverseGeocodeSerializer,
    TripPlanRequestSerializer,
    TripPlanResponseSerializer,
    TripReplanResponseSerializer,
)
from planner.domain.models import Coordinate
from planner.providers.base import RouteProviderError
from planner.providers.demo_fixture import DemoRouteProvider
from planner.providers.openrouteservice import OpenRouteServiceProvider
from planner.services.replan_service import ReplanInputError, TripReplanningService
from planner.services.trip_planner import TripPlanningService

PLAN_CONTEXT_TTL_SECONDS = 24 * 60 * 60


def plan_context_key(plan_id: str) -> str:
    return f"trip-plan-context:{plan_id}"


def provider_for(demo: bool):
    return DemoRouteProvider() if demo else OpenRouteServiceProvider()


class HealthView(APIView):
    throttle_classes = []

    @extend_schema(responses=inline_serializer("HealthResponse", {"status": serializers.CharField()}))
    def get(self, request):
        return Response({"status": "ok"})


class ReadyView(APIView):
    throttle_classes = []

    @extend_schema(
        responses=inline_serializer(
            "ReadinessResponse",
            {"status": serializers.CharField(), "live_routing_configured": serializers.BooleanField()},
        )
    )
    def get(self, request):
        return Response({"status": "ready", "live_routing_configured": bool(settings.OPENROUTESERVICE_API_KEY)})


class TripPlanView(APIView):
    @extend_schema(
        request=TripPlanRequestSerializer,
        responses=TripPlanResponseSerializer,
    )
    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cache_digest = hashlib.sha256(json.dumps(request.data, sort_keys=True, default=str).encode()).hexdigest()
        cache_key = f"trip-plan:{cache_digest}"
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            cache.set(
                plan_context_key(cached_result["plan_id"]),
                {"plan": cached_result, "request": dict(data)},
                PLAN_CONTEXT_TTL_SECONDS,
            )
            return Response(cached_result)
        try:
            result = TripPlanningService(
                provider_for(data["demo_mode"]),
                settings.PLANNING_PROVIDER_BUDGET_SECONDS,
            ).plan(data)
        except RouteProviderError as exc:
            return Response(
                {
                    "error": {
                        "code": exc.code,
                        "message": str(exc),
                        "field_errors": {},
                        "request_id": request.request_id,
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        cache.set(cache_key, result, 15 * 60)
        cache.set(
            plan_context_key(result["plan_id"]),
            {"plan": result, "request": dict(data)},
            PLAN_CONTEXT_TTL_SECONDS,
        )
        return Response(result)


class TripReplanView(APIView):
    @extend_schema(
        request=ReplanRequestSerializer,
        responses=TripReplanResponseSerializer,
    )
    def post(self, request):
        serializer = ReplanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        context = cache.get(plan_context_key(data["plan_id"]))
        if context is None:
            return Response(
                {
                    "error": {
                        "code": "PLAN_NOT_FOUND",
                        "message": "That plan is unavailable or its 24-hour replan window has expired.",
                        "field_errors": {"plan_id": ["Create a new plan and try again."]},
                        "request_id": request.request_id,
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            result = TripReplanningService(
                provider_for(context["request"]["demo_mode"]),
                settings.PLANNING_PROVIDER_BUDGET_SECONDS,
            ).replan(context, data)
        except ReplanInputError as exc:
            return Response(
                {
                    "error": {
                        "code": "REPLAN_VALIDATION_ERROR",
                        "message": str(exc),
                        "field_errors": {exc.field: [str(exc)]} if exc.field else {},
                        "request_id": request.request_id,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RouteProviderError as exc:
            return Response(
                {
                    "error": {
                        "code": exc.code,
                        "message": str(exc),
                        "field_errors": {},
                        "request_id": request.request_id,
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        cache.set(
            plan_context_key(result["plan_id"]),
            {"plan": result, "request": context["request"]},
            PLAN_CONTEXT_TTL_SECONDS,
        )
        return Response(result)


class AutocompleteView(APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=True, description="At least three characters"),
            OpenApiParameter("demo", bool, required=False),
        ],
        responses=inline_serializer(
            "AutocompleteResponse",
            {"results": serializers.ListField(child=serializers.DictField())},
        ),
    )
    def get(self, request):
        serializer = AutocompleteQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        cache_input = f"{data['demo']}:{data['q'].casefold()}".encode()
        key = f"autocomplete:{hashlib.sha256(cache_input).hexdigest()}"
        results = cache.get(key)
        if results is None:
            try:
                results = provider_for(data["demo"]).autocomplete(data["q"])
            except RouteProviderError as exc:
                return Response(
                    {
                        "error": {
                            "code": exc.code,
                            "message": str(exc),
                            "field_errors": {},
                            "request_id": request.request_id,
                        }
                    },
                    status=503,
                )
            cache.set(key, results, 3600)
        return Response({"results": results})


class ReverseGeocodeView(APIView):
    @extend_schema(
        request=ReverseGeocodeSerializer,
        responses=inline_serializer(
            "ReverseGeocodeResponse",
            {
                "label": serializers.CharField(),
                "country_code": serializers.CharField(allow_null=True),
                "supported_country": serializers.BooleanField(),
            },
        ),
    )
    def post(self, request):
        serializer = ReverseGeocodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = provider_for(data["demo"]).reverse_geocode_details(Coordinate(data["latitude"], data["longitude"]))
        except RouteProviderError as exc:
            return Response(
                {
                    "error": {
                        "code": exc.code,
                        "message": str(exc),
                        "field_errors": {},
                        "request_id": request.request_id,
                    }
                },
                status=503,
            )
        if not result.is_supported_country:
            return Response(
                {
                    "error": {
                        "code": "LOCATION_OUTSIDE_US",
                        "message": "That location is outside the supported United States service area.",
                        "field_errors": {},
                        "request_id": request.request_id,
                    }
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(
            {
                "label": result.label,
                "country_code": result.country_code,
                "supported_country": True,
            }
        )
