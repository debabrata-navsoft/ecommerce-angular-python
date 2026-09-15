from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import WishlistItem
from ..permissions import IsAuthenticated
from ..serializers import ProductIdSerializer, WishlistItemSerializer
from ..services.line_items import add_item, list_items, remove_item


def wishlist_items(user):
    return WishlistItemSerializer(list_items(WishlistItem, user), many=True).data


class WishlistView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'items': wishlist_items(request.user)})

    def post(self, request):
        """Idempotent: re-adding a product the user already saved is a no-op, not a 409."""
        payload = ProductIdSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        add_item(WishlistItem, request.user, payload.validated_data['productId'])
        return Response({'items': wishlist_items(request.user)}, status=status.HTTP_201_CREATED)


class WishlistItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, product_id):
        remove_item(WishlistItem, request.user, product_id)
        return Response({'items': wishlist_items(request.user)})
