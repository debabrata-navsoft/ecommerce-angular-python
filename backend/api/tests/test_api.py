"""
Port of the Node backend's end-to-end smoke test.

The point of this suite is contract fidelity: the Angular app was written against the
Express API, so every path, envelope key and status code asserted here is one the
frontend depends on. It also pins the security properties that matter — server-computed
totals, race-safe stock, and the authorization boundaries.
"""

from decimal import Decimal

from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import CartItem, Order, Product, SavedLaterItem, User, WishlistItem

ADDRESS = {
    'fullName': 'Smoke Test',
    'email': 'smoke@example.com',
    'phone': '9876543210',
    'address': '12 Test Lane',
    'city': 'Kolkata',
    'state': 'WB',
    'pinCode': '700001',
}


def make_product(**overrides):
    data = {
        'title': 'Test Product',
        'price': Decimal('100.00'),
        'stock': 10,
        'brand': 'Acme',
        'category': 'electronics',
        'sub_category': 'mobiles',
        'image': 'https://example.com/i.png',
        'description': '',
        'discount': Decimal('0'),
        'rating': Decimal('4.00'),
        'sales': 0,
        'views': 0,
    }
    data.update(overrides)
    return Product.objects.create(**data)


class ApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            email='admin@example.com',
            password='Admin@12345',
            first_name='Store',
            last_name='Admin',
            role=User.Role.ADMIN,
        )

    # -- helpers ---------------------------------------------------------------

    def signup(self, email='shopper@example.com', password='password123'):
        res = self.client.post(
            '/api/auth/signup',
            {'firstName': 'Smoke', 'lastName': 'Test', 'email': email, 'password': password},
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        return res.data['user']

    def login_admin(self):
        res = self.client.post(
            '/api/auth/admin/login',
            {'email': 'admin@example.com', 'password': 'Admin@12345'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        return res.data['user']

    def logout(self):
        self.client.post('/api/auth/logout')


class HealthTests(ApiTestCase):
    def test_health_reports_db_state(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'ok')
        self.assertEqual(res.data['db'], 'connected')

    def test_unknown_api_path_returns_json_envelope(self):
        res = self.client.get('/api/nope')
        self.assertEqual(res.status_code, 404)
        self.assertIn('message', res.json())


class AuthTests(ApiTestCase):
    def test_signup_returns_user_and_sets_cookie(self):
        user = self.signup()

        self.assertEqual(user['email'], 'shopper@example.com')
        self.assertEqual(user['role'], 'user')
        self.assertEqual(user['id'], user['uid'])  # both keys exposed
        self.assertEqual(user['displayName'], 'Smoke Test')
        self.assertNotIn('password', user)
        self.assertIn(settings.AUTH_COOKIE_NAME, self.client.cookies)
        self.assertTrue(self.client.cookies[settings.AUTH_COOKIE_NAME]['httponly'])

    def test_created_at_is_epoch_millis(self):
        user = self.signup()
        self.assertIsInstance(user['createdAt'], int)
        self.assertGreater(user['createdAt'], 1_000_000_000_000)

    def test_signup_rejects_short_password(self):
        res = self.client.post(
            '/api/auth/signup',
            {'firstName': 'A', 'lastName': 'B', 'email': 'x@y.com', 'password': 'short'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['message'], 'Validation failed')
        self.assertTrue(any(d['field'] == 'password' for d in res.data['details']))

    def test_signup_rejects_duplicate_email(self):
        self.signup()
        self.logout()

        res = self.client.post(
            '/api/auth/signup',
            {'firstName': 'A', 'lastName': 'B', 'email': 'shopper@example.com',
             'password': 'password123'},
            format='json',
        )
        self.assertEqual(res.status_code, 409)

    def test_me_is_public_and_returns_null_when_anonymous(self):
        res = self.client.get('/api/auth/me')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['user'])

    def test_me_returns_the_signed_in_user(self):
        self.signup()
        res = self.client.get('/api/auth/me')
        self.assertEqual(res.data['user']['email'], 'shopper@example.com')

    def test_customer_credentials_rejected_at_admin_login(self):
        self.signup()
        self.logout()

        res = self.client.post(
            '/api/auth/login',
            {'email': 'shopper@example.com', 'password': 'password123'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.logout()

        res = self.client.post(
            '/api/auth/admin/login',
            {'email': 'shopper@example.com', 'password': 'password123'},
            format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_admin_credentials_rejected_at_customer_login(self):
        res = self.client.post(
            '/api/auth/login',
            {'email': 'admin@example.com', 'password': 'Admin@12345'},
            format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_wrong_password_and_unknown_email_are_indistinguishable(self):
        unknown = self.client.post(
            '/api/auth/login', {'email': 'nope@example.com', 'password': 'password123'},
            format='json',
        )
        self.signup()
        self.logout()
        wrong = self.client.post(
            '/api/auth/login', {'email': 'shopper@example.com', 'password': 'wrongpassword'},
            format='json',
        )

        self.assertEqual(unknown.status_code, 401)
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(unknown.data['message'], wrong.data['message'])

    def test_logout_clears_the_cookie(self):
        self.signup()
        res = self.client.post('/api/auth/logout')

        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.client.cookies[settings.AUTH_COOKIE_NAME].value, '')

    def test_change_password_requires_the_current_one(self):
        self.signup()

        bad = self.client.post(
            '/api/auth/change-password',
            {'currentPassword': 'wrongpassword', 'newPassword': 'newpassword123'},
            format='json',
        )
        self.assertEqual(bad.status_code, 401)

        good = self.client.post(
            '/api/auth/change-password',
            {'currentPassword': 'password123', 'newPassword': 'newpassword123'},
            format='json',
        )
        self.assertEqual(good.status_code, 204)


class ProductTests(ApiTestCase):
    def test_list_returns_paging_envelope(self):
        for i in range(3):
            make_product(title=f'P{i}')

        res = self.client.get('/api/products')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            sorted(k for k in res.data if k != 'items'),
            ['limit', 'page', 'pages', 'total'],
        )
        self.assertEqual(res.data['total'], 3)
        self.assertEqual(res.data['limit'], 0)  # 0 means "everything"

    def test_limit_paginates(self):
        for i in range(5):
            make_product(title=f'P{i}')

        res = self.client.get('/api/products?limit=2&page=2')
        self.assertEqual(len(res.data['items']), 2)
        self.assertEqual(res.data['pages'], 3)

    def test_category_matches_either_level(self):
        make_product(title='Phone', category='electronics', sub_category='mobiles')
        make_product(title='Shoe', category='footwear', sub_category='sneakers')

        by_main = self.client.get('/api/products?category=electronics')
        by_sub = self.client.get('/api/products?category=mobiles')

        self.assertEqual(by_main.data['total'], 1)
        self.assertEqual(by_sub.data['total'], 1)
        self.assertEqual(by_sub.data['items'][0]['title'], 'Phone')

    def test_discount_price_is_derived_on_save(self):
        product = make_product(price=Decimal('1000'), discount=Decimal('25'))
        res = self.client.get(f'/api/products/{product.id}')

        self.assertEqual(Decimal(str(res.data['product']['discountPrice'])), Decimal('750.00'))

    def test_detail_increments_views(self):
        product = make_product(views=5)
        self.client.get(f'/api/products/{product.id}')

        product.refresh_from_db()
        self.assertEqual(product.views, 6)

    def test_unknown_product_is_404(self):
        res = self.client.get('/api/products/00000000-0000-0000-0000-000000000000')
        self.assertEqual(res.status_code, 404)

    def test_today_deals_and_discounted_thresholds(self):
        make_product(title='Deep', discount=Decimal('75'))
        make_product(title='Mid', discount=Decimal('55'))
        make_product(title='Shallow', discount=Decimal('10'))

        deals = self.client.get('/api/products/feed/today-deals')
        discounted = self.client.get('/api/products/feed/discounted')

        self.assertEqual([p['title'] for p in deals.data['items']], ['Deep'])
        self.assertEqual(
            sorted(p['title'] for p in discounted.data['items']), ['Deep', 'Mid']
        )

    def test_trending_excludes_best_sellers(self):
        # Best sellers is a top-20 cut, so this needs more than 20 products to say
        # anything: with fewer, every product is a best seller and trending is correctly
        # empty. 25 filler products fill the cut...
        for i in range(25):
            make_product(title=f'Filler {i}', sales=100 + i, views=1)

        # ...'Riser' has no sales so it misses the cut, but the most views, so it should
        # lead trending.
        make_product(title='Riser', sales=0, rating=Decimal('0'), views=9999)

        best_titles = [
            p['title'] for p in self.client.get('/api/products/feed/best-sellers').data['items']
        ]
        trending_titles = [
            p['title'] for p in self.client.get('/api/products/feed/trending').data['items']
        ]

        self.assertEqual(len(best_titles), 20)
        self.assertIn('Filler 24', best_titles)  # highest sales
        self.assertNotIn('Riser', best_titles)

        # The two feeds must not overlap.
        self.assertEqual(set(best_titles) & set(trending_titles), set())
        self.assertEqual(trending_titles[0], 'Riser')

    def test_writes_require_admin(self):
        self.signup()
        payload = {
            'title': 'Hack', 'price': 1, 'stock': 1, 'brand': 'b',
            'category': 'c', 'image': 'https://e.com/i.png',
        }

        self.assertEqual(
            self.client.post('/api/products', payload, format='json').status_code, 403
        )

        product = make_product()
        self.assertEqual(
            self.client.patch(f'/api/products/{product.id}', {'price': 1}, format='json').status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(f'/api/products/{product.id}').status_code, 403
        )

    def test_writes_require_authentication(self):
        res = self.client.post('/api/products', {}, format='json')
        self.assertEqual(res.status_code, 401)

    def test_admin_can_create_update_and_delete(self):
        self.login_admin()

        created = self.client.post(
            '/api/products',
            {'title': 'New', 'price': '500.00', 'stock': 3, 'brand': 'Acme',
             'category': 'Electronics', 'image': 'https://e.com/i.png', 'discount': '10'},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        # category is normalised to a lowercase slug
        self.assertEqual(created.data['product']['category'], 'electronics')
        self.assertEqual(Decimal(str(created.data['product']['discountPrice'])), Decimal('450.00'))

        product_id = created.data['product']['id']

        updated = self.client.patch(
            f'/api/products/{product_id}', {'price': '200.00'}, format='json'
        )
        self.assertEqual(Decimal(str(updated.data['product']['discountPrice'])), Decimal('180.00'))

        self.assertEqual(self.client.delete(f'/api/products/{product_id}').status_code, 204)


class CartTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.product = make_product(title='Widget', price=Decimal('50'), stock=3)
        self.other = make_product(title='Gadget', price=Decimal('20'), stock=5)

    def test_cart_requires_auth(self):
        self.assertEqual(self.client.get('/api/cart').status_code, 401)

    def test_add_increments_quantity(self):
        self.signup()

        self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')
        res = self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')

        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(res.data['items']), 1)
        self.assertEqual(res.data['items'][0]['quantity'], 2)
        # `id` is the product id, matching src/app/models/cart.model.ts
        self.assertEqual(res.data['items'][0]['id'], str(self.product.id))
        self.assertEqual(res.data['items'][0]['name'], 'Widget')

    def test_cannot_exceed_stock(self):
        self.signup()

        res = self.client.patch(
            f'/api/cart/{self.product.id}', {'quantity': 99999}, format='json'
        )
        # not in the cart yet -> 404; add first, then the stock ceiling applies
        self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')

        res = self.client.patch(
            f'/api/cart/{self.product.id}', {'quantity': 99999}, format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('Only 3 left in stock', res.data['message'])

    def test_quantity_zero_removes(self):
        self.signup()
        self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')

        res = self.client.patch(f'/api/cart/{self.product.id}', {'quantity': 0}, format='json')
        self.assertEqual(res.data['items'], [])

    def test_clear_cart(self):
        self.signup()
        self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')

        res = self.client.delete('/api/cart')
        self.assertEqual(res.data['items'], [])

    def test_save_for_later_moves_atomically(self):
        user = self.signup()
        self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')
        self.client.post('/api/cart', {'productId': str(self.other.id)}, format='json')

        res = self.client.post(f'/api/cart/{self.other.id}/save-for-later')

        self.assertEqual([i['name'] for i in res.data['items']], ['Widget'])
        self.assertEqual([i['name'] for i in res.data['savedLater']], ['Gadget'])
        # Exactly one row moved — nothing duplicated or dropped.
        self.assertEqual(CartItem.objects.filter(user_id=user['id']).count(), 1)
        self.assertEqual(SavedLaterItem.objects.filter(user_id=user['id']).count(), 1)

    def test_move_back_to_cart(self):
        self.signup()
        self.client.post('/api/cart', {'productId': str(self.other.id)}, format='json')
        self.client.post(f'/api/cart/{self.other.id}/save-for-later')

        res = self.client.post(f'/api/saved-later/{self.other.id}/move-to-cart')

        self.assertEqual(res.data['items'], [])
        self.assertEqual([i['name'] for i in res.data['cart']], ['Gadget'])

    def test_one_users_cart_is_invisible_to_another(self):
        self.signup('a@example.com')
        self.client.post('/api/cart', {'productId': str(self.product.id)}, format='json')
        self.logout()

        self.signup('b@example.com')
        res = self.client.get('/api/cart')
        self.assertEqual(res.data['items'], [])


class WishlistTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.product = make_product()

    def test_add_is_idempotent(self):
        user = self.signup()

        self.client.post('/api/wishlist', {'productId': str(self.product.id)}, format='json')
        res = self.client.post('/api/wishlist', {'productId': str(self.product.id)}, format='json')

        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(res.data['items']), 1)
        self.assertEqual(WishlistItem.objects.filter(user_id=user['id']).count(), 1)

    def test_wishlist_returns_products(self):
        self.signup()
        self.client.post('/api/wishlist', {'productId': str(self.product.id)}, format='json')

        res = self.client.get('/api/wishlist')
        item = res.data['items'][0]

        # Rendered as Product[], so it carries product fields, not cart-item fields.
        self.assertEqual(item['id'], str(self.product.id))
        self.assertEqual(item['title'], self.product.title)
        self.assertIn('discountPrice', item)

    def test_remove(self):
        self.signup()
        self.client.post('/api/wishlist', {'productId': str(self.product.id)}, format='json')

        res = self.client.delete(f'/api/wishlist/{self.product.id}')
        self.assertEqual(res.data['items'], [])


class OrderTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        # Same figures as the Node smoke test, so the totals below are directly comparable.
        self.collar = make_product(
            title='Reflective Nylon Dog Collar and Leash',
            price=Decimal('899'), discount=Decimal('74'), stock=190,
        )
        self.brush = make_product(
            title='Pet Grooming Deshedding Brush',
            price=Decimal('699'), discount=Decimal('53'), stock=230,
        )

    def place_cod_order(self):
        self.client.post('/api/cart', {'productId': str(self.collar.id)}, format='json')
        self.client.post('/api/cart', {'productId': str(self.collar.id)}, format='json')
        self.client.post('/api/cart', {'productId': str(self.brush.id)}, format='json')

        return self.client.post(
            '/api/orders',
            {'paymentMethod': 'cod', 'shippingMethod': 'express', 'address': ADDRESS},
            format='json',
        )

    def test_totals_are_computed_server_side(self):
        self.signup()
        res = self.place_cod_order()

        self.assertEqual(res.status_code, 201, res.data)
        order = res.data['order']

        # collar 899 -74% = 233.74 x2 = 467.48; brush 699 -53% = 328.53
        self.assertEqual(Decimal(str(order['subTotal'])), Decimal('796.01'))
        self.assertEqual(Decimal(str(order['gst'])), Decimal('143.28'))
        self.assertEqual(Decimal(str(order['shipping'])), Decimal('90.00'))
        self.assertEqual(Decimal(str(order['total'])), Decimal('1029.29'))
        self.assertEqual(order['paymentStatus'], 'confirmed')  # cod settles immediately
        self.assertIsNone(res.data['razorpay'])

    def test_client_supplied_totals_are_ignored(self):
        self.signup()
        self.client.post('/api/cart', {'productId': str(self.brush.id)}, format='json')

        res = self.client.post(
            '/api/orders',
            {'paymentMethod': 'cod', 'address': ADDRESS,
             'total': 1, 'subTotal': 1, 'gst': 0, 'items': []},
            format='json',
        )

        self.assertEqual(Decimal(str(res.data['order']['total'])), Decimal('387.67'))

    def test_placing_an_order_reserves_stock_and_clears_the_cart(self):
        user = self.signup()
        self.place_cod_order()

        self.collar.refresh_from_db()
        self.brush.refresh_from_db()

        self.assertEqual(self.collar.stock, 188)  # 190 - 2
        self.assertEqual(self.brush.stock, 229)
        self.assertEqual(CartItem.objects.filter(user_id=user['id']).count(), 0)

    def test_empty_cart_cannot_be_ordered(self):
        self.signup()

        res = self.client.post(
            '/api/orders', {'paymentMethod': 'cod', 'address': ADDRESS}, format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['message'], 'Your cart is empty')

    def test_order_beyond_stock_is_refused_and_rolls_back(self):
        self.signup()
        scarce = make_product(title='Scarce', price=Decimal('10'), stock=1)

        self.client.post('/api/cart', {'productId': str(scarce.id)}, format='json')
        self.client.post('/api/cart', {'productId': str(self.brush.id)}, format='json')

        # Drain the stock behind the cart's back, then try to check out.
        Product.objects.filter(pk=scarce.id).update(stock=0)

        res = self.client.post(
            '/api/orders', {'paymentMethod': 'cod', 'address': ADDRESS}, format='json'
        )

        self.assertEqual(res.status_code, 400)
        self.assertIn('does not have enough stock', res.data['message'])

        # The transaction rolled back: no order, and the other product's stock is intact.
        self.assertEqual(Order.objects.count(), 0)
        self.brush.refresh_from_db()
        self.assertEqual(self.brush.stock, 230)

    def test_address_is_validated(self):
        self.signup()
        self.client.post('/api/cart', {'productId': str(self.brush.id)}, format='json')

        res = self.client.post(
            '/api/orders',
            {'paymentMethod': 'cod', 'address': {**ADDRESS, 'pinCode': 'abc'}},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertTrue(any('pinCode' in d['field'] for d in res.data['details']))

    def test_customer_sees_only_their_own_orders(self):
        self.signup('a@example.com')
        self.place_cod_order()
        self.logout()

        self.signup('b@example.com')
        res = self.client.get('/api/orders')
        self.assertEqual(res.data['items'], [])

    def test_customer_cannot_list_all_orders(self):
        self.signup()
        self.assertEqual(self.client.get('/api/orders/all').status_code, 403)

    def test_another_user_cannot_read_the_order(self):
        self.signup('a@example.com')
        order_id = self.place_cod_order().data['order']['orderId']
        self.logout()

        self.signup('b@example.com')
        self.assertEqual(self.client.get(f'/api/orders/{order_id}').status_code, 403)

    def test_admin_lists_all_orders_and_can_ship(self):
        self.signup()
        order_id = self.place_cod_order().data['order']['orderId']
        self.logout()

        self.login_admin()

        listing = self.client.get('/api/orders/all')
        self.assertEqual(listing.data['total'], 1)

        shipped = self.client.patch(
            f'/api/orders/{order_id}/status', {'status': 'shipped'}, format='json'
        )
        self.assertEqual(shipped.data['order']['status'], 'shipped')

    def test_shipped_order_cannot_be_cancelled(self):
        self.signup()
        order_id = self.place_cod_order().data['order']['orderId']
        self.logout()

        self.login_admin()
        self.client.patch(f'/api/orders/{order_id}/status', {'status': 'shipped'}, format='json')

        res = self.client.post(f'/api/orders/{order_id}/cancel')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already shipped', res.data['message'])

    def test_cancelling_returns_the_stock(self):
        self.signup()
        order_id = self.place_cod_order().data['order']['orderId']

        res = self.client.post(f'/api/orders/{order_id}/cancel')
        self.assertEqual(res.data['order']['status'], 'cancelled')

        self.collar.refresh_from_db()
        self.assertEqual(self.collar.stock, 190)  # back to where it started

    def test_order_json_shape(self):
        self.signup()
        order = self.place_cod_order().data['order']

        self.assertEqual(order['id'], order['orderId'])  # public id, not the surrogate key
        self.assertEqual(len(order['items']), 2)
        self.assertEqual(set(order['items'][0]), {
            'productId', 'title', 'image', 'price', 'quantity', 'discount'
        })
        self.assertEqual(order['address']['pinCode'], '700001')
        self.assertIsInstance(order['createdAt'], int)

    def test_order_items_survive_product_deletion(self):
        self.signup()
        order_id = self.place_cod_order().data['order']['orderId']

        # OrderItem stores a snapshot, not a foreign key, so history is preserved.
        Product.objects.filter(pk=self.collar.id).delete()

        res = self.client.get(f'/api/orders/{order_id}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['order']['items']), 2)


class PaymentTests(ApiTestCase):
    def test_config_reports_whether_razorpay_is_available(self):
        res = self.client.get('/api/payments/config')

        self.assertEqual(res.status_code, 200)
        self.assertIn('configured', res.data['razorpay'])
        self.assertIn('keyId', res.data['razorpay'])

    def test_online_order_is_refused_when_razorpay_is_unconfigured(self):
        # No RAZORPAY_KEY_SECRET in the test env, so the service reports 503 rather than
        # leaving an unpayable order behind.
        self.signup()
        product = make_product()
        self.client.post('/api/cart', {'productId': str(product.id)}, format='json')

        res = self.client.post(
            '/api/orders',
            {'paymentMethod': 'card', 'address': ADDRESS},
            format='json',
        )

        self.assertEqual(res.status_code, 503)
        # The rollback ran: stock returned and the order is cancelled, not payable.
        order = Order.objects.first()
        if order is not None:
            self.assertEqual(order.status, 'cancelled')


class UserTests(ApiTestCase):
    def test_listing_users_requires_admin(self):
        self.signup()
        self.assertEqual(self.client.get('/api/users').status_code, 403)

    def test_admin_can_list_and_search_users(self):
        self.signup('shopper@example.com')
        self.logout()
        self.login_admin()

        res = self.client.get('/api/users')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['items']), 2)

        filtered = self.client.get('/api/users?search=shopper')
        self.assertEqual(len(filtered.data['items']), 1)

    def test_user_cannot_read_another_user(self):
        first = self.signup('a@example.com')
        self.logout()
        self.signup('b@example.com')

        self.assertEqual(self.client.get(f'/api/users/{first["id"]}').status_code, 403)

    def test_user_can_read_and_update_themselves(self):
        user = self.signup()

        res = self.client.patch(
            f'/api/users/{user["id"]}', {'firstName': 'Renamed'}, format='json'
        )
        self.assertEqual(res.data['user']['firstName'], 'Renamed')

    def test_profile_patch_cannot_escalate_role(self):
        user = self.signup()

        res = self.client.patch(
            f'/api/users/{user["id"]}', {'role': 'admin'}, format='json'
        )
        self.assertEqual(res.data['user']['role'], 'user')

    def test_only_admin_can_change_a_role(self):
        user = self.signup()
        self.assertEqual(
            self.client.patch(f'/api/users/{user["id"]}/role', {'role': 'admin'},
                              format='json').status_code,
            403,
        )

        self.logout()
        self.login_admin()

        res = self.client.patch(
            f'/api/users/{user["id"]}/role', {'role': 'admin'}, format='json'
        )
        self.assertEqual(res.data['user']['role'], 'admin')

    def test_only_admin_can_delete_a_user(self):
        user = self.signup()
        self.assertEqual(self.client.delete(f'/api/users/{user["id"]}').status_code, 403)

        self.logout()
        self.login_admin()
        self.assertEqual(self.client.delete(f'/api/users/{user["id"]}').status_code, 204)


class AddressTests(ApiTestCase):
    def test_address_crud_is_keyed_by_id(self):
        user = self.signup()
        base = f'/api/users/{user["id"]}/addresses'

        created = self.client.post(base, ADDRESS, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(len(created.data['items']), 1)

        address_id = created.data['items'][0]['id']
        self.assertEqual(created.data['items'][0]['fullName'], 'Smoke Test')
        self.assertEqual(created.data['items'][0]['pinCode'], '700001')

        updated = self.client.patch(
            f'{base}/{address_id}', {**ADDRESS, 'city': 'Mumbai'}, format='json'
        )
        self.assertEqual(updated.data['items'][0]['city'], 'Mumbai')

        deleted = self.client.delete(f'{base}/{address_id}')
        self.assertEqual(deleted.data['items'], [])

    def test_addresses_appear_on_the_user(self):
        user = self.signup()
        self.client.post(f'/api/users/{user["id"]}/addresses', ADDRESS, format='json')

        res = self.client.get('/api/auth/me')
        self.assertEqual(len(res.data['user']['addresses']), 1)

    def test_invalid_address_is_rejected(self):
        user = self.signup()

        res = self.client.post(
            f'/api/users/{user["id"]}/addresses', {**ADDRESS, 'phone': 'nope'}, format='json'
        )
        self.assertEqual(res.status_code, 400)

    def test_cannot_add_an_address_to_another_user(self):
        first = self.signup('a@example.com')
        self.logout()
        self.signup('b@example.com')

        res = self.client.post(
            f'/api/users/{first["id"]}/addresses', ADDRESS, format='json'
        )
        self.assertEqual(res.status_code, 403)
