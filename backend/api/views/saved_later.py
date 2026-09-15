from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import CartItem, SavedLaterItem
from ..permissions import IsAuthenticated
from ..serializers import CartItemSerializer, ProductIdSerializer
from ..services.line_items import add_item, list_items, move_item, remove_item
from .cart import cart_items, saved_items


class SavedLaterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'items': saved_items(request.user)})

    def post(self, request):
        payload = ProductIdSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        add_item(SavedLaterItem, request.user, payload.validated_data['productId'])
        return Response({'items': saved_items(request.user)}, status=status.HTTP_201_CREATED)


class SavedLaterItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, product_id):
        remove_item(SavedLaterItem, request.user, product_id)
        return Response({'items': saved_items(request.user)})


class MoveToCartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, product_id):
        move_item(SavedLaterItem, CartItem, request.user, product_id)

        return Response({'items': saved_items(request.user), 'cart': cart_items(request.user)})
