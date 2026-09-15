from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication

from .models import User

ALGORITHM = settings.JWT_ALGORITHM
COOKIE = settings.AUTH_COOKIE_NAME


def sign_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user.id),
        'role': user.role,
        'email': user.email,
        'iat': now,
        'exp': now + timedelta(days=settings.JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def set_auth_cookie(response, token: str):
    """
    httpOnly so the token is unreachable from JavaScript, and SameSite=Lax in development
    so it still rides along on the Angular SSR navigation requests. Production serves
    cross-site, which requires SameSite=None and therefore Secure.
    """
    secure = not settings.DEBUG
    response.set_cookie(
        COOKIE,
        token,
        max_age=settings.JWT_EXPIRES_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite='None' if secure else 'Lax',
        path='/',
    )
    return response


def clear_auth_cookie(response):
    secure = not settings.DEBUG
    response.delete_cookie(COOKIE, path='/', samesite='None' if secure else 'Lax')
    return response


def read_token(request) -> str | None:
    token = request.COOKIES.get(COOKIE)
    if token:
        return token

    header = request.META.get('HTTP_AUTHORIZATION', '')
    if header.startswith('Bearer '):
        return header[7:].strip()

    return None


class CookieJWTAuthentication(BaseAuthentication):
    """
    Resolves the session from the httpOnly cookie, falling back to
    `Authorization: Bearer ...` for non-browser clients.

    An expired or tampered token is treated as anonymous rather than an error, so public
    endpoints keep working for a visitor holding a stale cookie. The permission classes
    are what reject.
    """

    def authenticate(self, request):
        token = read_token(request)
        if not token:
            return None

        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        except jwt.PyJWTError:
            return None

        # Re-read the user on every request so a role change or deletion takes effect
        # immediately instead of waiting for the token to expire.
        user = User.objects.filter(pk=payload.get('sub'), is_active=True).first()
        if user is None:
            return None

        return (user, token)

    def authenticate_header(self, request):
        # Presence of this makes DRF answer 401 (not 403) when authentication is missing.
        return 'Cookie'
