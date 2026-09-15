from decimal import ROUND_HALF_UP, Decimal

"""
Single source of truth for order maths. The Angular checkout page computes the same
figures for display, but the server recomputes them from live product prices at order
time and stores its own result — a client-supplied total is never trusted.

Mirrors checkout-page.ts: gst = subTotal * 0.18, express shipping = 90, free = 0.
Decimal rather than float, so the totals cannot drift by fractions of a paisa.
"""

CENTS = Decimal('0.01')

GST_RATE = Decimal('0.18')

SHIPPING_RATES = {
    'free': Decimal('0'),
    'express': Decimal('90'),
}


def round2(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP)


def discounted_unit_price(price: Decimal, discount: Decimal | None = None) -> Decimal:
    if not discount:
        return Decimal(price)
    return Decimal(price) - (Decimal(price) * Decimal(discount) / Decimal(100))


def line_total(price: Decimal, discount: Decimal | None, quantity: int) -> Decimal:
    return discounted_unit_price(price, discount) * Decimal(quantity)


def price_order(lines: list[tuple[Decimal, Decimal | None, int]], shipping_method='free') -> dict:
    """`lines` is a list of (price, discount, quantity)."""
    shipping = SHIPPING_RATES.get(shipping_method, Decimal('0'))

    sub_total = round2(sum((line_total(*line) for line in lines), Decimal('0')))
    gst = round2(sub_total * GST_RATE)

    return {
        'sub_total': sub_total,
        'gst': gst,
        'shipping': shipping,
        'total': round2(sub_total + gst + shipping),
    }
