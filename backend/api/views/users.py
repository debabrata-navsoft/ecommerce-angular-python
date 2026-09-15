from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..exceptions import ApiError
from ..models import Address
from ..permissions import IsAdmin, IsSelfOrAdmin
from ..serializers import (
    AddressSerializer,
    AddressWriteSerializer,
    ProfileUpdateSerializer,
    RoleSerializer,
    UserSerializer,
)

User = get_user_model()


def find_user_or_404(user_id):
    user = User.objects.filter(pk=user_id).first()
    if user is None:
        raise ApiError.not_found('User not found')
    return user


def address_list(user):
    return AddressSerializer(user.addresses.all(), many=True).data


class UserListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = User.objects.all()

        if request.query_params.get('role'):
            queryset = queryset.filter(role=request.query_params['role'])

        term = request.query_params.get('search')
        if term:
            queryset = queryset.filter(
                Q(email__icontains=term)
                | Q(first_name__icontains=term)
                | Q(last_name__icontains=term)
            )

        return Response({'items': UserSerializer(queryset, many=True).data})


class UserDetailView(APIView):
    permission_classes = [IsSelfOrAdmin]

    def get(self, request, user_id):
        return Response({'user': UserSerializer(find_user_or_404(user_id)).data})

    def patch(self, request, user_id):
        user = find_user_or_404(user_id)

        payload = ProfileUpdateSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)

        # `role` is deliberately not settable here — privilege changes are not part of a
        # profile edit, and this route is reachable by the user themselves.
        for field, value in payload.to_model_fields().items():
            setattr(user, field, value)
        user.save()

        return Response({'user': UserSerializer(user).data})

    def delete(self, request, user_id):
        # GET/PATCH are self-or-admin, but deleting an account is admin-only, so this
        # method tightens the permission rather than living on a separate path.
        self.permission_classes = [IsAdmin]
        self.check_permissions(request)

        # Cart/wishlist/saved-later rows cascade; orders are kept as business records
        # because OrderItem holds a snapshot rather than a foreign key to the product.
        find_user_or_404(user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserRoleView(APIView):
    """Admin-only, and kept off the profile-edit route on purpose."""

    permission_classes = [IsAdmin]

    def patch(self, request, user_id):
        payload = RoleSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        user = find_user_or_404(user_id)
        user.role = payload.validated_data['role']
        user.save(update_fields=['role', 'updated_at'])

        return Response({'user': UserSerializer(user).data})


class AddressListView(APIView):
    permission_classes = [IsSelfOrAdmin]

    def get(self, request, user_id):
        return Response({'items': address_list(find_user_or_404(user_id))})

    def post(self, request, user_id):
        user = find_user_or_404(user_id)

        payload = AddressWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        Address.objects.create(user=user, **payload.to_model_fields())

        return Response({'items': address_list(user)}, status=status.HTTP_201_CREATED)


class AddressDetailView(APIView):
    """Addresses are resolved by id, never by array index."""

    permission_classes = [IsSelfOrAdmin]

    def get_address(self, user, address_id):
        address = user.addresses.filter(pk=address_id).first()
        if address is None:
            raise ApiError.not_found('Address not found')
        return address

    def patch(self, request, user_id, address_id):
        user = find_user_or_404(user_id)
        address = self.get_address(user, address_id)

        payload = AddressWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        for field, value in payload.to_model_fields().items():
            setattr(address, field, value)
        address.save()

        return Response({'items': address_list(user)})

    def delete(self, request, user_id, address_id):
        user = find_user_or_404(user_id)
        self.get_address(user, address_id).delete()

        return Response({'items': address_list(user)})
