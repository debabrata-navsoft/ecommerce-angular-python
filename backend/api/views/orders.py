from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..exceptions import ApiError
from ..models import Order
from ..permissions import IsAdmin, IsAuthenticated
from ..serializers import OrderSerializer, OrderStatusSerializer, PlaceOrderSerializer
from ..services import razorpay_client
from ..services.orders import abandon_order, cancel_order, create_order_from_cart
from .products import paginated


def load_owned_order(request, order_id: str) -> Order:
    """Loads an order and enforces that the caller owns it, unless they are an admin."""
    order = Order.objects.filter(order_id=order_id).prefetch_related('items').first()
    if order is None:
        raise ApiError.not_found('Order not found')

    if order.user_id != request.user.id and not request.user.is_admin:
        raise ApiError.forbidden()

    return order


class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(user=request.user).prefetch_related('items')
        return Response({'items': OrderSerializer(orders, many=True).data})

    def post(self, request):
        payload = PlaceOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        # The nested serializer already validated these; freeze them onto the order in
        # the camelCase shape the client sends and expects back.
        snapshot = {
            'fullName': data['address']['fullName'].strip(),
            'email': data['address']['email'].strip().lower(),
            'phone': str(data['address']['phone']).strip(),
            'address': data['address']['address'].strip(),
            'landmark': (data['address'].get('landmark') or '').strip(),
            'city': data['address']['city'].strip(),
            'state': data['address']['state'].strip(),
            'pinCode': str(data['address']['pinCode']).strip(),
        }

        payment_method = data['paymentMethod']
        order = create_order_from_cart(
            request.user, snapshot, data.get('shippingMethod', 'free'), payment_method
        )

        if payment_method == 'cod':
            return Response(
                {'order': OrderSerializer(order).data, 'razorpay': None},
                status=status.HTTP_201_CREATED,
            )

        # The Razorpay order is created here so the client gets everything it needs to
        # open the checkout in a single round trip.
        try:
            rp = razorpay_client.create_order(
                amount=order.total,
                receipt=order.order_id,
                notes={'orderId': order.order_id, 'userId': str(order.user_id)},
            )
        except Exception:
            # Roll the order back rather than leaving reserved stock behind an order that
            # can never be paid.
            try:
                abandon_order(order)
            except Exception:
                pass
            raise

        order.razorpay_order_id = rp['id']
        order.save(update_fields=['razorpay_order_id', 'updated_at'])

        return Response(
            {
                'order': OrderSerializer(order).data,
                'razorpay': {
                    'keyId': razorpay_client.public_key(),
                    'orderId': rp['id'],
                    'amount': rp['amount'],
                    'currency': rp['currency'],
                },
            },
            status=status.HTTP_201_CREATED,
        )


class AllOrdersView(APIView):
    """
    Admin view of every order. Mongo needed a mirrored `orders` collection to make this
    query possible; one indexed table now serves both this and the customer's history.
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = Order.objects.prefetch_related('items')

        if request.query_params.get('status'):
            queryset = queryset.filter(status=request.query_params['status'])
        if request.query_params.get('userId'):
            queryset = queryset.filter(user_id=request.query_params['userId'])

        return Response(paginated(queryset, request.query_params, OrderSerializer))


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = load_owned_order(request, order_id)
        return Response({'order': OrderSerializer(order).data})


class CancelOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        order = cancel_order(load_owned_order(request, order_id))
        return Response({'order': OrderSerializer(order).data})


class OrderStatusView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, order_id):
        payload = OrderStatusSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        new_status = payload.validated_data['status']

        order = load_owned_order(request, order_id)

        # Cancelling has to return the reserved stock, so it goes through the service
        # rather than a bare status write.
        if new_status == Order.Status.CANCELLED:
            order = cancel_order(order)
        else:
            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])

        return Response({'order': OrderSerializer(order).data})
