from django.db import IntegrityError, transaction

from ..exceptions import ApiError
from ..models import Product


def list_items(Model, user):
    """Always joins the product, so a caller sees current price and stock."""
    return Model.objects.select_related('product').filter(user=user)


def add_item(Model, user, product_id, increment: bool = False):
    """
    Adds a product to a list, or bumps its quantity when `increment` is set (the cart).
    The unique (user, product) constraint makes a double-click safe: the second insert
    collides and is turned into an increment rather than an error.
    """
    product = Product.objects.filter(pk=product_id).first()
    if product is None:
        raise ApiError.not_found('Product not found')

    existing = Model.objects.filter(user=user, product=product).first()

    if existing:
        if not increment:
            return existing

        if existing.quantity + 1 > product.stock:
            raise ApiError.bad_request(f'Only {product.stock} left in stock')

        existing.quantity += 1
        existing.save(update_fields=['quantity', 'updated_at'])
        return existing

    if increment and product.stock < 1:
        raise ApiError.bad_request('This product is out of stock')

    try:
        with transaction.atomic():
            return Model.objects.create(user=user, product=product, quantity=1)
    except IntegrityError:
        # Another request won the race; treat it as an increment.
        return add_item(Model, user, product_id, increment=increment)


def set_quantity(Model, user, product_id, quantity: int):
    if quantity <= 0:
        remove_item(Model, user, product_id)
        return None

    product = Product.objects.filter(pk=product_id).first()
    if product is None:
        raise ApiError.not_found('Product not found')

    if quantity > product.stock:
        raise ApiError.bad_request(f'Only {product.stock} left in stock')

    item = Model.objects.filter(user=user, product=product).first()
    if item is None:
        raise ApiError.not_found('Item is not in this list')

    item.quantity = quantity
    item.save(update_fields=['quantity', 'updated_at'])
    return item


def remove_item(Model, user, product_id) -> None:
    deleted, _ = Model.objects.filter(user=user, product_id=product_id).delete()
    if not deleted:
        raise ApiError.not_found('Item is not in this list')


def clear_list(Model, user) -> None:
    Model.objects.filter(user=user).delete()


@transaction.atomic
def move_item(FromModel, ToModel, user, product_id) -> None:
    """
    Moves a row between two lists in one transaction — this is what makes "save for
    later" and "move to cart" atomic. The original client code did the removal and the
    save as two separate calls, and losing one lost the item.
    """
    source = FromModel.objects.filter(user=user, product_id=product_id).first()
    if source is None:
        raise ApiError.not_found('Item is not in this list')

    quantity = source.quantity
    source.delete()

    target = ToModel.objects.filter(user=user, product_id=product_id).first()
    if target:
        target.quantity = quantity
        target.save(update_fields=['quantity', 'updated_at'])
    else:
        ToModel.objects.create(user=user, product_id=product_id, quantity=quantity)
