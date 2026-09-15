from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from ..exceptions import ApiError
from ..permissions import IsAuthenticated
from ..serializers import OrderSerializer, VerifyPaymentSerializer
from ..services import razorpay_client
from ..services.orders import abandon_order
from .orders import load_owned_order


class PaymentConfigView(APIView):
    """Lets the client know whether online payment is available before offering it."""

    def get(self, request):
        return Response(
            {
                'razorpay': {
                    'configured': settings.RAZORPAY_CONFIGURED,
                    'keyId': razorpay_client.public_key(),
                }
            }
        )


class VerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        payload = VerifyPaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        order = load_owned_order(request, order_id)

        # Already settled — a replayed callback is harmless.
        if order.is_settled:
            return Response({'order': OrderSerializer(order).data})

        # Bind the callback to the Razorpay order this order actually created, so a valid
        # signature from some *other* payment cannot be replayed onto this one.
        if not order.razorpay_order_id or order.razorpay_order_id != data['razorpayOrderId']:
            raise ApiError.bad_request('Payment does not belong to this order')

        valid = razorpay_client.verify_signature(
            data['razorpayOrderId'], data['razorpayPaymentId'], data['signature']
        )

        if not valid:
            try:
                abandon_order(order)
            except Exception:
                pass
            raise ApiError.bad_request('Payment signature verification failed')

        order.payment_status = order.PaymentStatus.PAID
        order.razorpay_payment_id = data['razorpayPaymentId']
        order.save(update_fields=['payment_status', 'razorpay_payment_id', 'updated_at'])

        return Response({'order': OrderSerializer(order).data})


class AbandonPaymentView(APIView):
    """Called when the user dismisses the Razorpay modal or the payment fails outright."""

    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        reason = 'cancelled' if request.data.get('reason') == 'cancelled' else 'failed'
        order = abandon_order(load_owned_order(request, order_id), reason=reason)

        return Response({'order': OrderSerializer(order).data})
