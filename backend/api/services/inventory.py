from django.db.models import F

from ..exceptions import ApiError
from ..models import Product


def reserve_stock(lines: list[dict]) -> None:
    """
    Stock moves through a single conditional UPDATE — `stock__gte=quantity` in the filter
    means the decrement only applies if the stock is still there, and the row lock is held
    by the database. Two shoppers racing for the last unit cannot both succeed, which a
    read-then-write check would allow.

    Must be called inside `transaction.atomic()`; a failure raises so the transaction
    rolls back the decrements already applied.
    """
    for line in lines:
        updated = Product.objects.filter(pk=line['product_id'], stock__gte=line['quantity']).update(
            stock=F('stock') - line['quantity'],
            sales=F('sales') + line['quantity'],
        )

        if not updated:
            raise ApiError.bad_request(f'"{line["title"]}" does not have enough stock left')


def release_stock(items) -> None:
    """Returns reserved stock when an order is cancelled or its payment never completes."""
    for item in items:
        Product.objects.filter(pk=item.product_id).update(
            stock=F('stock') + item.quantity,
            sales=F('sales') - item.quantity,
        )
