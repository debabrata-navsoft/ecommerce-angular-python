from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, NotAuthenticated, PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ApiError(APIException):
    """
    Every failure leaves the API as `{ "message": ..., "details"?: [...] }`, so the
    Angular ApiService can surface `message` directly.
    """

    def __init__(self, status_code: int, message: str, details=None):
        self.status_code = status_code
        self.message = message
        self.details = details
        super().__init__(message)

    @classmethod
    def bad_request(cls, message='Bad request', details=None):
        return cls(status.HTTP_400_BAD_REQUEST, message, details)

    @classmethod
    def unauthorized(cls, message='Not authenticated'):
        return cls(status.HTTP_401_UNAUTHORIZED, message)

    @classmethod
    def forbidden(cls, message='Not authorized'):
        return cls(status.HTTP_403_FORBIDDEN, message)

    @classmethod
    def not_found(cls, message='Not found'):
        return cls(status.HTTP_404_NOT_FOUND, message)

    @classmethod
    def conflict(cls, message='Already exists'):
        return cls(status.HTTP_409_CONFLICT, message)

    @classmethod
    def unavailable(cls, message='Service unavailable'):
        return cls(status.HTTP_503_SERVICE_UNAVAILABLE, message)


def _flatten(errors, prefix='') -> list[dict]:
    """Turns DRF's nested error dict into the flat [{field, message}] list."""
    out: list[dict] = []

    if isinstance(errors, dict):
        for field, value in errors.items():
            path = f'{prefix}.{field}' if prefix else str(field)
            out.extend(_flatten(value, path))
    elif isinstance(errors, list):
        for item in errors:
            if isinstance(item, (dict, list)):
                out.extend(_flatten(item, prefix))
            else:
                out.append({'field': prefix or 'detail', 'message': str(item)})
    else:
        out.append({'field': prefix or 'detail', 'message': str(errors)})

    return out


def api_exception_handler(exc, context):
    if isinstance(exc, ApiError):
        body = {'message': exc.message}
        if exc.details:
            body['details'] = exc.details
        return Response(body, status=exc.status_code)

    if isinstance(exc, DjangoValidationError):
        exc = DRFValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)

    if isinstance(exc, DRFValidationError):
        return Response(
            {'message': 'Validation failed', 'details': _flatten(exc.detail)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, Http404):
        return Response({'message': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if isinstance(exc, NotAuthenticated):
        return Response({'message': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)

    if isinstance(exc, PermissionDenied):
        return Response({'message': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    response = exception_handler(exc, context)
    if response is None:
        return None  # let Django's 500 handling take over

    detail = response.data.get('detail') if isinstance(response.data, dict) else None
    response.data = {'message': str(detail) if detail else 'Request failed'}
    return response
