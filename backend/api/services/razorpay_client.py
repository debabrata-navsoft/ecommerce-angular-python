import hashlib
import hmac
from decimal import Decimal

import razorpay
from django.conf import settings

from ..exceptions import ApiError

_client = None


def _get_client():
    global _client

    if not settings.RAZORPAY_CONFIGURED:
        raise ApiError.unavailable('Razorpay is not configured on this server')

    if _client is None:
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    return _client


def public_key() -> str:
    return settings.RAZORPAY_KEY_ID


def create_order(amount: Decimal, receipt: str, notes: dict) -> dict:
    order = _get_client().order.create(
        {
            'amount': int(Decimal(amount) * 100),  # Razorpay works in paise
            'currency': 'INR',
            'receipt': receipt,
            'notes': notes,
        }
    )

    return {'id': order['id'], 'amount': order['amount'], 'currency': order['currency']}


def verify_signature(razorpay_order_id: str, razorpay_payment_id: str, signature: str) -> bool:
    """
    The key security guarantee: the browser reports a payment id, and only the server
    holds the secret needed to recompute the HMAC over `<order_id>|<payment_id>`. A forged
    success callback cannot mark an order paid.
    """
    if not settings.RAZORPAY_CONFIGURED:
        raise ApiError.unavailable('Razorpay is not configured on this server')

    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f'{razorpay_order_id}|{razorpay_payment_id}'.encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, str(signature or ''))
