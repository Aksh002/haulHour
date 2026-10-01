import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
# Local development configuration lives at the repository root. Existing process
# variables keep priority, so hosted secrets supplied by Render are never replaced.
load_dotenv(BASE_DIR.parent / ".env", override=False)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-key")
DEBUG = False
ALLOWED_HOSTS = [host for host in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if host]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "planner",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "planner.api.middleware.RequestIdMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = []
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
USE_TZ = True
TIME_ZONE = "UTC"
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 64 * 1024
CORS_ALLOWED_ORIGINS = [value for value in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if value]
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "planner.api.exception_handlers.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "120/hour"},
}
SPECTACULAR_SETTINGS = {
    "TITLE": "HaulHour API",
    "DESCRIPTION": "Projected HOS-aware trip planning demonstration API",
    "VERSION": "1.0.0",
}
ROUTING_PROVIDER = os.getenv("ROUTING_PROVIDER", "openrouteservice")
OPENROUTESERVICE_API_KEY = os.getenv("OPENROUTESERVICE_API_KEY", "")
DEFAULT_TERMINAL_TIMEZONE = "America/Chicago"
DEFAULT_TRIP_START = "2026-10-05T06:00:00-05:00"
PLANNING_PROVIDER_BUDGET_SECONDS = float(os.getenv("PLANNING_PROVIDER_BUDGET_SECONDS", "45"))
ROUTING_SNAP_RADIUS_METERS = int(os.getenv("ROUTING_SNAP_RADIUS_METERS", "1500"))
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "request": {
            "format": (
                "event=%(message)s request_id=%(request_id)s method=%(method)s path=%(path)s "
                "status=%(status_code)s error_code=%(error_code)s duration_ms=%(duration_ms)s"
            )
        },
        "provider": {
            "format": "event=%(message)s operation=%(operation)s outcome=%(outcome)s duration_ms=%(duration_ms)s"
        },
    },
    "handlers": {
        "request_console": {"class": "logging.StreamHandler", "formatter": "request"},
        "provider_console": {"class": "logging.StreamHandler", "formatter": "provider"},
    },
    "loggers": {
        "haulhour.request": {"handlers": ["request_console"], "level": "INFO", "propagate": False},
        "haulhour.provider": {"handlers": ["provider_console"], "level": "INFO", "propagate": False},
    },
}
