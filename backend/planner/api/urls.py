from django.urls import path

from .views import AutocompleteView, HealthView, ReadyView, ReverseGeocodeView, TripPlanView, TripReplanView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("ready/", ReadyView.as_view(), name="ready"),
    path("trips/plan/", TripPlanView.as_view(), name="trip-plan"),
    path("trips/replan/", TripReplanView.as_view(), name="trip-replan"),
    path("locations/autocomplete/", AutocompleteView.as_view(), name="autocomplete"),
    path("locations/reverse/", ReverseGeocodeView.as_view(), name="reverse-geocode"),
]
