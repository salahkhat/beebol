from pathlib import Path

import environ

import os
import sys

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)

environ.Env.read_env(str(BASE_DIR / ".env"))

SECRET_KEY = env("SECRET_KEY", default="dev")
DEBUG = env.bool("DEBUG", default=True)

# Media storage selection
USE_GCS_MEDIA = env.bool("USE_GCS_MEDIA", default=not DEBUG)

# Safety switch for admin-triggered data seeding.
# Defaults to DEBUG to avoid accidental production usage.
ADMIN_SEEDING_ENABLED = env.bool("ADMIN_SEEDING_ENABLED", default=DEBUG)

ALLOWED_HOSTS = [h.strip() for h in env("ALLOWED_HOSTS", default="127.0.0.1,localhost").split(",") if h.strip()]

# Render sets this for web services.
render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "django.contrib.sites",
    "django.contrib.sitemaps",
    "bootstrapform",
    "sorl.thumbnail",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    # local
    "api",
    "market",
    "messaging",
    "reports",
    "notifications",
    # classifieds domain app (local editable install from backend/)
    "django_classified",
    "storages",
]

SITE_ID = 1

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "api.middleware.RequestIdAndLoggingMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "beebol_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "beebol_backend.wsgi.application"

DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}",
    )
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django 4.2+ storage configuration (Django 5+ ignores DEFAULT_FILE_STORAGE).
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
}

# Tests don't run `collectstatic`, so manifest-based staticfiles storage will fail
# when templates resolve `{% static %}` paths. Use a non-manifest storage backend
# for pytest runs only.
if "pytest" in sys.modules:
    STORAGES["staticfiles"]["BACKEND"] = "django.contrib.staticfiles.storage.StaticFilesStorage"
    WHITENOISE_MANIFEST_STRICT = False

GS_BUCKET_NAME = env("GS_BUCKET_NAME", default="beebol_images_bucket")
GS_CREDENTIALS = None

if USE_GCS_MEDIA:
    STORAGES["default"] = {"BACKEND": "storages.backends.gcloud.GoogleCloudStorage"}

    from google.oauth2 import service_account

    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if creds_path:
        GS_CREDENTIALS = service_account.Credentials.from_service_account_file(creds_path)

    MEDIA_URL = f"https://storage.googleapis.com/{GS_BUCKET_NAME}/"
else:
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"

WEB_ORIGIN = env("WEB_ORIGIN", default="")
if WEB_ORIGIN:
    CORS_ALLOWED_ORIGINS = [WEB_ORIGIN]
    CSRF_TRUSTED_ORIGINS = [WEB_ORIGIN]
else:
    CORS_ALLOWED_ORIGINS = []
    CSRF_TRUSTED_ORIGINS = []

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "EXCEPTION_HANDLER": "api.v1.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
        "api.v1.throttling.MethodScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("DRF_THROTTLE_ANON", default="60/min"),
        "user": env("DRF_THROTTLE_USER", default="300/min"),
        "auth": env("DRF_THROTTLE_AUTH", default="10/min"),
        "write": env("DRF_THROTTLE_WRITE", default="30/min"),
        "messaging": env("DRF_THROTTLE_MESSAGING", default="60/min"),
    },
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}


# Background jobs (Phase 6)
# Celery is optional and can be enabled in deployments that provide a broker (e.g., Redis).
CELERY_ENABLED = env.bool("CELERY_ENABLED", default=False)

# Prefer explicit broker configuration in production; default to local Redis for dev convenience.
CELERY_BROKER_URL = env(
    "CELERY_BROKER_URL",
    default=("redis://127.0.0.1:6379/0" if DEBUG else ""),
)

# Keep results off by default to avoid extra storage requirements.
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="")

# Tests should not require a running broker.
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=("pytest" in sys.modules))
CELERY_TASK_EAGER_PROPAGATES = True


# Anti-spam (Trust & Safety v1)
# These are additional guards on top of DRF throttling.
SPAM_MESSAGE_COOLDOWN_SECONDS = env.int("SPAM_MESSAGE_COOLDOWN_SECONDS", default=2)
SPAM_DUPLICATE_MESSAGE_WINDOW_SECONDS = env.int("SPAM_DUPLICATE_MESSAGE_WINDOW_SECONDS", default=60)
SPAM_QUESTION_COOLDOWN_SECONDS = env.int("SPAM_QUESTION_COOLDOWN_SECONDS", default=10)
SPAM_DUPLICATE_QUESTION_WINDOW_SECONDS = env.int("SPAM_DUPLICATE_QUESTION_WINDOW_SECONDS", default=60)


# Listing quality (Phase 1)
LISTING_MIN_IMAGES_PUBLISH = env.int("LISTING_MIN_IMAGES_PUBLISH", default=1)
LISTING_MIN_TITLE_LEN = env.int("LISTING_MIN_TITLE_LEN", default=5)
LISTING_MIN_DESCRIPTION_LEN = env.int("LISTING_MIN_DESCRIPTION_LEN", default=10)
LISTING_IMAGE_MIN_WIDTH = env.int("LISTING_IMAGE_MIN_WIDTH", default=400)
LISTING_IMAGE_MIN_HEIGHT = env.int("LISTING_IMAGE_MIN_HEIGHT", default=400)


# Email (optional; used for notification emails when enabled)
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default=(
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@beebol.local")
EMAIL_SUBJECT_PREFIX = env("EMAIL_SUBJECT_PREFIX", default="[Beebol] ")
EMAIL_NOTIFICATIONS_ENABLED = env.bool("EMAIL_NOTIFICATIONS_ENABLED", default=False)


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "beebol_backend.logging_utils.JsonFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "loggers": {
        "beebol.request": {
            "handlers": ["console"],
            "level": env("REQUEST_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("ROOT_LOG_LEVEL", default="WARNING"),
    },
}

