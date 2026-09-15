from decimal import Decimal

from rest_framework import serializers

from .models import Address, Order, Product, User

PHONE_RE = r'^[0-9+\-\s()]{7,20}$'
PIN_RE = r'^[0-9]{4,10}$'


class EpochMillisField(serializers.Field):
    """
    The Angular models type `createdAt` as a number, so timestamps go out as epoch
    millis rather than ISO strings.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault('read_only', True)
        super().__init__(**kwargs)

    def to_representation(self, value):
        return int(value.timestamp() * 1000) if value else None


# --------------------------------------------------------------------------- read


class AddressSerializer(serializers.ModelSerializer):
    fullName = serializers.CharField(source='full_name')
    pinCode = serializers.CharField(source='pin_code')
    createdAt = EpochMillisField(source='created_at')

    class Meta:
        model = Address
        fields = [
            'id', 'fullName', 'email', 'phone', 'address',
            'landmark', 'city', 'state', 'pinCode', 'createdAt',
        ]


class UserSerializer(serializers.ModelSerializer):
    # The Angular `User` model keys off `uid`; both are exposed so either works.
    uid = serializers.UUIDField(source='id', read_only=True)
    firstName = serializers.CharField(source='first_name')
    lastName = serializers.CharField(source='last_name')
    phoneNumber = serializers.ListField(source='phone_numbers', child=serializers.CharField())
    displayName = serializers.CharField(source='display_name', read_only=True)
    addresses = AddressSerializer(many=True, read_only=True)
    createdAt = EpochMillisField(source='created_at')
    updatedAt = EpochMillisField(source='updated_at')

    class Meta:
        model = User
        # `password` is never a field here, so it cannot leak.
        fields = [
            'id', 'uid', 'firstName', 'lastName', 'email', 'phoneNumber',
            'role', 'displayName', 'addresses', 'createdAt', 'updatedAt',
        ]


class ProductSerializer(serializers.ModelSerializer):
    searchName = serializers.CharField(source='search_name', read_only=True)
    subCategory = serializers.CharField(source='sub_category')
    discountPrice = serializers.DecimalField(
        source='discount_price', max_digits=12, decimal_places=2, read_only=True
    )
    createdAt = EpochMillisField(source='created_at')
    updatedAt = EpochMillisField(source='updated_at')

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'searchName', 'price', 'stock', 'brand', 'color',
            'category', 'subCategory', 'image', 'description', 'sales', 'views',
            'discount', 'discountPrice', 'rating', 'createdAt', 'updatedAt',
        ]


class CartItemSerializer(serializers.Serializer):
    """
    Flattens a line item plus its joined product into the shape
    `src/app/models/cart.model.ts` declares, where `id` is the product id.
    """

    def to_representation(self, item):
        product = item.product
        return {
            'id': str(product.id),
            'productId': str(product.id),
            'name': product.title,
            'price': product.price,
            'discount': product.discount,
            'image': product.image,
            'category': product.category,
            'subCategory': product.sub_category,
            'brand': product.brand,
            'stock': product.stock,
            'quantity': item.quantity,
            'createdAt': int(item.created_at.timestamp() * 1000) if item.created_at else None,
        }


class WishlistItemSerializer(serializers.Serializer):
    """The wishlist renders as Product[], so return the product plus the pin time."""

    def to_representation(self, item):
        data = ProductSerializer(item.product).data
        data['createdAt'] = int(item.created_at.timestamp() * 1000) if item.created_at else None
        return data


class OrderItemSerializer(serializers.Serializer):
    def to_representation(self, item):
        return {
            'productId': str(item.product_id),
            'title': item.title,
            'image': item.image,
            'price': item.price,
            'quantity': item.quantity,
            'discount': item.discount,
        }


class OrderSerializer(serializers.ModelSerializer):
    # Clients address an order by its public order_id, not the surrogate key.
    id = serializers.CharField(source='order_id', read_only=True)
    orderId = serializers.CharField(source='order_id', read_only=True)
    userId = serializers.UUIDField(source='user_id', read_only=True)
    userEmail = serializers.EmailField(source='user_email', read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    subTotal = serializers.DecimalField(
        source='sub_total', max_digits=12, decimal_places=2, read_only=True
    )
    shippingMethod = serializers.CharField(source='shipping_method', read_only=True)
    paymentMethod = serializers.CharField(source='payment_method', read_only=True)
    paymentStatus = serializers.CharField(source='payment_status', read_only=True)
    razorpayOrderId = serializers.CharField(source='razorpay_order_id', read_only=True)
    razorpayPaymentId = serializers.CharField(source='razorpay_payment_id', read_only=True)
    createdAt = EpochMillisField(source='created_at')
    updatedAt = EpochMillisField(source='updated_at')

    class Meta:
        model = Order
        fields = [
            'id', 'orderId', 'userId', 'userEmail', 'items', 'address',
            'subTotal', 'gst', 'shipping', 'total', 'shippingMethod', 'status',
            'paymentMethod', 'paymentStatus', 'razorpayOrderId', 'razorpayPaymentId',
            'createdAt', 'updatedAt',
        ]


# -------------------------------------------------------------------------- write


class SignupSerializer(serializers.Serializer):
    firstName = serializers.CharField(max_length=150, trim_whitespace=True)
    lastName = serializers.CharField(max_length=150, trim_whitespace=True)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    phoneNumber = serializers.JSONField(required=False)

    def validate_phoneNumber(self, value):
        if value in (None, ''):
            return []
        return value if isinstance(value, list) else [str(value)]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ProfileUpdateSerializer(serializers.Serializer):
    firstName = serializers.CharField(max_length=150, required=False)
    lastName = serializers.CharField(max_length=150, required=False)
    phoneNumber = serializers.JSONField(required=False)

    def validate_phoneNumber(self, value):
        if value in (None, ''):
            return []
        return value if isinstance(value, list) else [str(value)]

    def to_model_fields(self) -> dict:
        data = self.validated_data
        mapping = {'firstName': 'first_name', 'lastName': 'last_name', 'phoneNumber': 'phone_numbers'}
        return {mapping[k]: v for k, v in data.items() if k in mapping}


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(write_only=True)
    newPassword = serializers.CharField(min_length=8, write_only=True)


class AddressWriteSerializer(serializers.Serializer):
    """Matches AddressUser / OrderAddress in the Angular models."""

    fullName = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.RegexField(PHONE_RE, error_messages={'invalid': 'A valid phone number is required'})
    address = serializers.CharField(max_length=255)
    landmark = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100)
    state = serializers.CharField(max_length=100)
    # Kept a string because the client model allows string | number and leading zeros matter.
    pinCode = serializers.RegexField(PIN_RE, error_messages={'invalid': 'A valid PIN code is required'})

    def to_model_fields(self) -> dict:
        d = self.validated_data
        return {
            'full_name': d['fullName'].strip(),
            'email': d['email'].strip().lower(),
            'phone': str(d['phone']).strip(),
            'address': d['address'].strip(),
            'landmark': (d.get('landmark') or '').strip(),
            'city': d['city'].strip(),
            'state': d['state'].strip(),
            'pin_code': str(d['pinCode']).strip(),
        }

    def to_snapshot(self) -> dict:
        """The JSON blob frozen onto an order."""
        d = self.validated_data
        return {
            'fullName': d['fullName'].strip(),
            'email': d['email'].strip().lower(),
            'phone': str(d['phone']).strip(),
            'address': d['address'].strip(),
            'landmark': (d.get('landmark') or '').strip(),
            'city': d['city'].strip(),
            'state': d['state'].strip(),
            'pinCode': str(d['pinCode']).strip(),
        }


class ProductWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0'))
    stock = serializers.IntegerField(min_value=0)
    brand = serializers.CharField(max_length=150)
    category = serializers.CharField(max_length=100)
    image = serializers.CharField(max_length=500)

    subCategory = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    color = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    discount = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal('0'), max_value=Decimal('100'),
        required=False,
    )
    rating = serializers.DecimalField(
        max_digits=3, decimal_places=2, min_value=Decimal('0'), max_value=Decimal('5'),
        required=False,
    )
    sales = serializers.IntegerField(min_value=0, required=False)
    views = serializers.IntegerField(min_value=0, required=False)

    def to_model_fields(self) -> dict:
        mapping = {'subCategory': 'sub_category'}
        return {mapping.get(k, k): v for k, v in self.validated_data.items()}


class PlaceOrderSerializer(serializers.Serializer):
    address = AddressWriteSerializer()
    shippingMethod = serializers.ChoiceField(choices=['free', 'express'], required=False, default='free')
    paymentMethod = serializers.ChoiceField(choices=['cod', 'upi', 'card', 'emi', 'netbanking'])


class VerifyPaymentSerializer(serializers.Serializer):
    razorpayPaymentId = serializers.CharField()
    razorpayOrderId = serializers.CharField()
    signature = serializers.CharField()


class ProductIdSerializer(serializers.Serializer):
    productId = serializers.UUIDField()


class QuantitySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0)


class OrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['pending', 'shipped', 'delivered', 'cancelled'])


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=['user', 'admin'])
