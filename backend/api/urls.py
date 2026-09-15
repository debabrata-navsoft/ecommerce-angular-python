import time

from django.db import connection
from django.urls import path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .views import auth, cart, orders, payments, products, saved_later, users, wishlist

_STARTED_AT = time.monotonic()


@api_view(['GET'])
@permission_classes([AllowAny])
def health(_request):
    try:
        connection.ensure_connection()
        db = 'connected'
    except Exception:
        db = 'disconnected'

    return Response({'status': 'ok', 'db': db, 'uptime': time.monotonic() - _STARTED_AT})


urlpatterns = [
    path('health', health),

    # --- auth ---
    path('auth/signup', auth.SignupView.as_view()),
    path('auth/login', auth.LoginView.as_view()),
    path('auth/admin/login', auth.AdminLoginView.as_view()),
    path('auth/logout', auth.LogoutView.as_view()),
    path('auth/me', auth.MeView.as_view()),
    path('auth/change-password', auth.ChangePasswordView.as_view()),

    # --- products ---
    # The curated feeds sit under /feed so they cannot collide with an id.
    path('products', products.ProductListView.as_view()),
    path('products/feed/trending', products.TrendingView.as_view()),
    path('products/feed/best-sellers', products.BestSellersView.as_view()),
    path('products/feed/today-deals', products.TodayDealsView.as_view()),
    path('products/feed/discounted', products.DiscountedView.as_view()),
    path('products/<uuid:product_id>', products.ProductDetailView.as_view()),

    # --- users ---
    path('users', users.UserListView.as_view()),
    path('users/<uuid:user_id>', users.UserDetailView.as_view()),
    path('users/<uuid:user_id>/role', users.UserRoleView.as_view()),
    path('users/<uuid:user_id>/addresses', users.AddressListView.as_view()),
    path('users/<uuid:user_id>/addresses/<uuid:address_id>', users.AddressDetailView.as_view()),

    # --- cart ---
    path('cart', cart.CartView.as_view()),
    path('cart/<uuid:product_id>', cart.CartItemView.as_view()),
    path('cart/<uuid:product_id>/save-for-later', cart.SaveForLaterView.as_view()),

    # --- wishlist ---
    path('wishlist', wishlist.WishlistView.as_view()),
    path('wishlist/<uuid:product_id>', wishlist.WishlistItemView.as_view()),

    # --- saved later ---
    path('saved-later', saved_later.SavedLaterView.as_view()),
    path('saved-later/<uuid:product_id>', saved_later.SavedLaterItemView.as_view()),
    path('saved-later/<uuid:product_id>/move-to-cart', saved_later.MoveToCartView.as_view()),

    # --- orders ---
    # /all is a fixed segment declared before the id route so it cannot be shadowed.
    path('orders', orders.OrderListView.as_view()),
    path('orders/all', orders.AllOrdersView.as_view()),
    path('orders/<str:order_id>', orders.OrderDetailView.as_view()),
    path('orders/<str:order_id>/cancel', orders.CancelOrderView.as_view()),
    path('orders/<str:order_id>/status', orders.OrderStatusView.as_view()),

    # --- payments ---
    path('payments/config', payments.PaymentConfigView.as_view()),
    path('payments/<str:order_id>/verify', payments.VerifyPaymentView.as_view()),
    path('payments/<str:order_id>/abandon', payments.AbandonPaymentView.as_view()),
]
