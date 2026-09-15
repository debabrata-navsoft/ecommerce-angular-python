from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CartItem, SavedLaterItem
from ..permissions import IsAuthenticated
from ..serializers import CartItemSerializer, ProductIdSerializer, QuantitySerializer
from ..services.line_items import add_item, clear_list, list_items, move_item, remove_item, set_quantity


def cart_items(user):
    return CartItemSerializer(list_items(CartItem, user), many=True).data


def saved_items(user):
    return CartItemSerializer(list_items(SavedLaterItem, user), many=True).data


class CartView(APIView):
    """Scoped to the signed-in user; there is no userId in any of these paths."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'items': cart_items(request.user)})

    def post(self, request):
        payload = ProductIdSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        add_item(CartItem, request.user, payload.validated_data['productId'], increment=True)
        return Response({'items': cart_items(request.user)}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        clear_list(CartItem, request.user)
        return Response({'items': []})


class CartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, product_id):
        payload = QuantitySerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        set_quantity(CartItem, request.user, product_id, payload.validated_data['quantity'])
        return Response({'items': cart_items(request.user)})

    def delete(self, request, product_id):
        remove_item(CartItem, request.user, product_id)
        return Response({'items': cart_items(request.user)})


class SaveForLaterView(APIView):
    """One request does both halves of the move, so the two lists cannot drift apart."""

    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        move_item(CartItem, SavedLaterItem, request.user, product_id)

        return Response(
            {'items': cart_items(request.user), 'savedLater': saved_items(request.user)}
        )
