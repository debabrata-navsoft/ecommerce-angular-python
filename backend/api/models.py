import secrets
import uuid
from decimal import Decimal

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

# Money uses Decimal rather than float so totals cannot drift. `discount` is a percentage.
MONEY = {'max_digits': 12, 'decimal_places': 2}


class UUIDModel(models.Model):
    """
    UUID primary keys instead of auto-increment integers: ids appear in URLs
    (/api/users/<id>, /api/products/<id>), and sequential ids would let anyone enumerate
    every user and order. The Angular models treat ids as opaque strings either way.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError('An email address is required')

        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault('role', User.Role.USER)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=User.Role.ADMIN, is_staff=True, is_superuser=True)
        return self._create(email, password, **extra)


class User(UUIDModel, AbstractBaseUser, PermissionsMixin):
    """
    Email is the login identifier — there is no username. `role` carries the
    customer/admin split, and each login endpoint accepts exactly one value, so an admin
    credential cannot open a customer session or vice versa.
    """

    class Role(models.TextChoices):
        USER = 'user'
        ADMIN = 'admin'

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    # The Angular `User` model types this as string[]. Stored as JSON rather than a side
    # table because it is never queried, only read back whole.
    phone_numbers = models.JSONField(default=list, blank=True)

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER, db_index=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    @property
    def display_name(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN


class Address(UUIDModel):
    """
    Was an embedded array on the Mongo user document. As its own table each row has a
    real id, which is what the address endpoints address — never an array index.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')

    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    address = models.CharField(max_length=255)
    landmark = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=10)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_addresses'
        # Newest first, matching what the API returned before.
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name}, {self.city}'


def discounted_price(price: Decimal, discount: Decimal | None) -> Decimal:
    if not discount:
        return price
    return (price - (price * discount / Decimal(100))).quantize(Decimal('0.01'))


class Product(UUIDModel, TimestampedModel):
    title = models.CharField(max_length=255)

    # Lowercased title, maintained in save(), so search never needs a case-insensitive
    # scan of the original casing.
    search_name = models.CharField(max_length=255, db_index=True, blank=True, default='')

    price = models.DecimalField(**MONEY)
    stock = models.PositiveIntegerField(default=0)
    brand = models.CharField(max_length=150)
    color = models.CharField(max_length=100, blank=True, default='')

    # Compared lowercased against the slugs in src/app/data/category.data.ts.
    category = models.CharField(max_length=100, db_index=True)
    sub_category = models.CharField(max_length=100, blank=True, default='', db_index=True)

    image = models.URLField(max_length=500)
    description = models.TextField(blank=True, default='')

    sales = models.PositiveIntegerField(default=0)
    views = models.PositiveIntegerField(default=0)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))

    # Derived from price/discount on save so it can be sorted and filtered in SQL.
    discount_price = models.DecimalField(**MONEY, default=Decimal('0'))

    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0'))

    class Meta:
        db_table = 'products'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'sub_category']),
            models.Index(fields=['-discount', '-created_at']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.category = (self.category or '').strip().lower()
        self.sub_category = (self.sub_category or '').strip().lower()
        self.search_name = (self.title or '').strip().lower()
        self.discount_price = discounted_price(self.price, self.discount)
        super().save(*args, **kwargs)


class LineItem(UUIDModel, TimestampedModel):
    """
    Shared base for the three per-user product lists (cart, wishlist, saved-later). They
    hold only a reference — the product is joined on read, so a price or stock edit shows
    up in every list at once instead of going stale in each. Orders are the deliberate
    exception and freeze a snapshot.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='+')
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class CartItem(LineItem):
    class Meta(LineItem.Meta):
        abstract = False
        db_table = 'cart_items'
        # One row per product per user — makes add-to-cart an idempotent upsert.
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uniq_cart_user_product')
        ]


class WishlistItem(LineItem):
    class Meta(LineItem.Meta):
        abstract = False
        db_table = 'wishlist_items'
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uniq_wishlist_user_product')
        ]


class SavedLaterItem(LineItem):
    class Meta(LineItem.Meta):
        abstract = False
        db_table = 'saved_later_items'
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uniq_saved_user_product')
        ]


def generate_order_id() -> str:
    """Short, URL-safe, unguessable — it appears in /cart/order-success/:id."""
    return secrets.token_urlsafe(9)


class Order(UUIDModel, TimestampedModel):
    class Status(models.TextChoices):
        PENDING = 'pending'
        SHIPPED = 'shipped'
        DELIVERED = 'delivered'
        CANCELLED = 'cancelled'

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending'
        PAID = 'paid'
        CONFIRMED = 'confirmed'
        FAILED = 'failed'

    class PaymentMethod(models.TextChoices):
        COD = 'cod'
        UPI = 'upi'
        CARD = 'card'
        EMI = 'emi'
        NETBANKING = 'netbanking'

    class ShippingMethod(models.TextChoices):
        FREE = 'free'
        EXPRESS = 'express'

    # The public identifier clients use, distinct from the surrogate primary key.
    order_id = models.CharField(max_length=32, unique=True, default=generate_order_id)

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    user_email = models.EmailField()

    # Frozen snapshot of the delivery address; never queried, so JSON keeps the shape the
    # client sends and expects back.
    address = models.JSONField()

    sub_total = models.DecimalField(**MONEY)
    gst = models.DecimalField(**MONEY)
    shipping = models.DecimalField(**MONEY, default=Decimal('0'))
    total = models.DecimalField(**MONEY)
    shipping_method = models.CharField(
        max_length=10, choices=ShippingMethod.choices, default=ShippingMethod.FREE
    )

    # Fulfilment state — distinct from payment_status, matching models/payment.model.ts.
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True
    )

    payment_method = models.CharField(max_length=12, choices=PaymentMethod.choices)
    payment_status = models.CharField(
        max_length=12, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )

    razorpay_order_id = models.CharField(max_length=64, blank=True, default='')
    razorpay_payment_id = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
        # Serves both the customer's history and the admin list; the Mongo version needed
        # a second mirrored collection to make the admin query possible.
        indexes = [models.Index(fields=['user', '-created_at'])]

    def __str__(self):
        return self.order_id

    @property
    def is_settled(self) -> bool:
        return self.payment_status in {self.PaymentStatus.PAID, self.PaymentStatus.CONFIRMED}


class OrderItem(models.Model):
    """
    Frozen line item. `product_id` is stored as a plain value, not a foreign key: the
    order must survive the product being deleted, and its price must not follow later
    edits to the catalogue.
    """

    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')

    product_id = models.UUIDField()
    title = models.CharField(max_length=255)
    image = models.URLField(max_length=500)
    price = models.DecimalField(**MONEY)
    quantity = models.PositiveIntegerField()
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))

    class Meta:
        db_table = 'order_items'
        ordering = ['id']

    def __str__(self):
        return f'{self.title} x{self.quantity}'
