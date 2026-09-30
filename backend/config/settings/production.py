from .base import *  # noqa: F403

if SECRET_KEY == "development-only-key":  # noqa: F405
    raise RuntimeError("DJANGO_SECRET_KEY must be configured in production")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
