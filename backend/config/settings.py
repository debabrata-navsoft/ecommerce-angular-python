import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Anchored to the package root rather than the working directory, so management commands
# work from any directory.
load_dotenv(BASE_DIR / '.env')


def env_list(key: str, default: str = '') -> list[str]:
    return [item.strip() for item in os.environ.get(key, default).split(',') if item.strip()]


def env_bool(key: str, default: bool = False) -> bool:
    return os.environ.get(key, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def env_required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f'Missing required environment variable {key}. Expected it in '
            f'{BASE_DIR / ".env"} (copy .env.example to .env and fill it in).'
        )
    return value


DEBUG = env_bool('DJANGO_DEBUG', True)

# Django's SECRET_KEY only signs framework machinery here (sessions, admin). The auth
# tokens use JWT_SECRET, which is required outright.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or (
    'insecure-dev-only-key' if DEBUG else env_required('DJANGO_SECRET_KEY')
)

JWT_SECRET = env_required('JWT_SECRET')
JWT_EXPIRES_DAYS = int(os.environ.get('JWT_EXPIRES_DAYS', '7'))
JWT_ALGORITHM = 'HS256'
AUTH_COOKIE_NAME = 'access_token'

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'api',
]

MIDDLEWARE = [
    # CorsMiddleware must precede CommonMiddleware so preflight replies carry the headers.
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --- Database -----------------------------------------------------------------------
# MySQL is the target. DB_ENGINE=sqlite exists so the suite can run without a MySQL
# server; the ORM code is identical either way.
if os.environ.get('DB_ENGINE', 'mysql').strip().lower() == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('DB_NAME', 'ecommerce'),
            'USER': os.environ.get('DB_USER', 'root'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
            'PORT': os.environ.get('DB_PORT', '3306'),
            'OPTIONS': {
                'charset': 'utf8mb4',
                # STRICT_ALL_TABLES makes MySQL reject bad values instead of silently
                # truncating them; the isolation level matches what row-locking expects.
                'init_command': "SET sql_mode='STRICT_ALL_TABLES'",
            },
            'CONN_MAX_AGE': 60,
        }
    }

AUTH_USER_MODEL = 'api.User'

# Argon2 first — stronger than the PBKDF2 default, and stronger than the bcrypt the Node
# API used. Existing hashes of other types are still verified and upgraded on login.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.ScryptPasswordHasher',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.authentication.CookieJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'EXCEPTION_HANDLER': 'api.exceptions.api_exception_handler',
    'UNAUTHENTICATED_USER': None,
    # The Angular models type money as numbers, so decimals must not serialize as strings.
    'COERCE_DECIMAL_TO_STRING': False,
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
}

CORS_ALLOWED_ORIGINS = env_list('CORS_ORIGINS', 'http://localhost:4200')
# Required for the httpOnly session cookie to travel cross-origin (:4200 -> :8000).
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_CONFIGURED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)

SEED_ADMIN_EMAIL = os.environ.get('SEED_ADMIN_EMAIL', 'admin@example.com')
SEED_ADMIN_PASSWORD = os.environ.get('SEED_ADMIN_PASSWORD', 'admin12345')

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
