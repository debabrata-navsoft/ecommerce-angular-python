from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..authentication import clear_auth_cookie, set_auth_cookie, sign_token
from ..exceptions import ApiError
from ..permissions import IsAuthenticated
from ..serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    SignupSerializer,
    UserSerializer,
)

User = get_user_model()


def session_response(user, http_status=status.HTTP_200_OK) -> Response:
    response = Response({'user': UserSerializer(user).data}, status=http_status)
    return set_auth_cookie(response, sign_token(user))


class SignupView(APIView):
    def post(self, request):
        payload = SignupSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        email = data['email'].lower()
        if User.objects.filter(email=email).exists():
            raise ApiError.conflict('That email is already registered')

        user = User.objects.create_user(
            email=email,
            password=data['password'],
            first_name=data['firstName'].strip(),
            last_name=data['lastName'].strip(),
            phone_numbers=data.get('phoneNumber') or [],
            role=User.Role.USER,
        )

        return session_response(user, status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    One credential store, two entry points. `expected_role` is what keeps the customer
    and admin areas separate: each endpoint refuses the other's role, enforced here on
    the server so calling the API directly cannot bypass it.
    """

    expected_role = User.Role.USER

    def post(self, request):
        payload = LoginSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        email = payload.validated_data['email'].lower()
        user = User.objects.filter(email=email).first()

        # Identical message whether the email is unknown or the password is wrong, so the
        # endpoint cannot be used to enumerate registered addresses.
        if user is None or not user.check_password(payload.validated_data['password']):
            raise ApiError.unauthorized('Invalid email or password')

        if user.role != self.expected_role:
            raise ApiError.forbidden(
                'This account is not an admin account'
                if self.expected_role == User.Role.ADMIN
                else 'Use the admin login for this account'
            )

        return session_response(user)


class AdminLoginView(LoginView):
    expected_role = User.Role.ADMIN


class LogoutView(APIView):
    def post(self, request):
        return clear_auth_cookie(Response(status=status.HTTP_204_NO_CONTENT))


class MeView(APIView):
    def get(self, request):
        """Public: returns `{ user: null }` when anonymous rather than 401."""
        user = request.user
        return Response({'user': UserSerializer(user).data if user else None})

    def patch(self, request):
        if request.user is None:
            raise ApiError.unauthorized()

        payload = ProfileUpdateSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)

        for field, value in payload.to_model_fields().items():
            setattr(request.user, field, value)
        request.user.save()

        return Response({'user': UserSerializer(request.user).data})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = ChangePasswordSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        if not request.user.check_password(payload.validated_data['currentPassword']):
            raise ApiError.unauthorized('Current password is incorrect')

        request.user.set_password(payload.validated_data['newPassword'])
        request.user.save(update_fields=['password'])

        # Re-issue so the existing cookie keeps working after the change.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return set_auth_cookie(response, sign_token(request.user))
