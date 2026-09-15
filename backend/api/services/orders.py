from django.db import transaction

from ..exceptions import ApiError
from ..models import CartItem, Order, OrderItem
from .inventory import release_stock, reserve_stock
from .pricing import price_order


@transaction.atomic
def create_order_from_cart(user, address: dict, shipping_method: str, payment_method: str) -> Order:
    """
    Builds an order from the server's view of the user's cart. The client sends only the
    address, shipping choice and payment method — items, prices and totals are all read
    from the database, so a tampered request cannot buy a large item for a rupee.
    """
    rows = list(CartItem.objects.select_related('product').filter(user=user))
    if not rows:
        raise ApiError.bad_request('Your cart is empty')

    lines = [
        {
            'product_id': row.product.id,
            'title': row.product.title,
            'image': row.product.image,
            'price': row.product.price,
            'discount': row.product.discount,
            'quantity': row.quantity,
        }
        for row in rows
    ]

    totals = price_order(
        [(line['price'], line['discount'], line['quantity']) for line in lines],
        shipping_method,
    )

    # Raises if any line is short, which rolls the whole transaction back.
    reserve_stock(lines)

    is_cod = payment_method == 'cod'

    order = Order.objects.create(
        user=user,
        user_email=user.email,
        address=address,
        sub_total=totals['sub_total'],
        gst=totals['gst'],
        shipping=totals['shipping'],
        total=totals['total'],
        shipping_method=shipping_method,
        status=Order.Status.PENDING,
        payment_method=payment_method,
        # 'cod' never touches Razorpay, so it is settled the moment it is placed.
        payment_status=Order.PaymentStatus.CONFIRMED if is_cod else Order.PaymentStatus.PENDING,
    )

    OrderItem.objects.bulk_create([OrderItem(order=order, **line) for line in lines])

    CartItem.objects.filter(user=user).delete()

    return order


@transaction.atomic
def abandon_order(order: Order, reason: str = 'failed') -> Order:
    """
    Undoes an order that was placed but never paid for — a dismissed Razorpay modal, a
    failed card, or a Razorpay outage during creation. Idempotent, because the client may
    report a dismissal more than once.
    """
    if order.is_settled:
        raise ApiError.bad_request('This order is already paid')

    if order.status == Order.Status.CANCELLED:
        return order

    release_stock(order.items.all())

    order.status = Order.Status.CANCELLED
    order.payment_status = (
        Order.PaymentStatus.PENDING if reason == 'cancelled' else Order.PaymentStatus.FAILED
    )
    order.save(update_fields=['status', 'payment_status', 'updated_at'])

    return order


@transaction.atomic
def cancel_order(order: Order) -> Order:
    """Customer-initiated cancellation, allowed only before the order ships."""
    if order.status in {Order.Status.SHIPPED, Order.Status.DELIVERED}:
        raise ApiError.bad_request(f'Cannot cancel an order that is already {order.status}')

    if order.status == Order.Status.CANCELLED:
        return order

    release_stock(order.items.all())

    order.status = Order.Status.CANCELLED
    order.save(update_fields=['status', 'updated_at'])

    return order
