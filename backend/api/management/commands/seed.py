import re
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import CartItem, Order, Product, SavedLaterItem, User, WishlistItem

from .products_data import SAMPLE_PRODUCTS

# The admin email is a login credential for /admin, and every login endpoint validates
# the field as an email address — so a bare username would create an account that can
# never sign in. Fail now with an explanation rather than later with a confusing 400.
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

DECIMAL_FIELDS = {'price', 'discount', 'rating'}


class Command(BaseCommand):
    help = 'Creates the admin user and the sample catalogue, and reports the result.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete products, carts, wishlists, saved-later and orders first.',
        )

    def handle(self, *args, **options):
        reset = options['reset']

        if reset:
            with transaction.atomic():
                for model in (CartItem, WishlistItem, SavedLaterItem, Order, Product):
                    deleted, _ = model.objects.all().delete()
                    self.stdout.write(f'[seed] cleared {model.__name__}: {deleted} rows')

        self.seed_admin()
        self.seed_products()

        self.stdout.write(self.style.SUCCESS('[seed] done'))

    def seed_admin(self):
        email = settings.SEED_ADMIN_EMAIL
        password = settings.SEED_ADMIN_PASSWORD

        if not EMAIL_RE.match(email):
            raise CommandError(
                f'SEED_ADMIN_EMAIL="{email}" is not an email address. The admin signs in '
                'with an email, so use something like admin@example.com.'
            )

        if len(password) < 8:
            raise CommandError('SEED_ADMIN_PASSWORD must be at least 8 characters.')

        # Upsert so re-running the seed rotates the password instead of failing on the
        # unique email constraint.
        user, created = User.objects.get_or_create(
            email=email.lower(),
            defaults={'first_name': 'Store', 'last_name': 'Admin'},
        )

        user.role = User.Role.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        verb = 'created' if created else 'updated'
        self.stdout.write(f'[seed] admin {verb}: {user.email}')

    def seed_products(self):
        created = skipped = 0

        for data in SAMPLE_PRODUCTS:
            if Product.objects.filter(title=data['title']).exists():
                skipped += 1
                continue

            fields = {
                key: (Decimal(str(value)) if key in DECIMAL_FIELDS else value)
                for key, value in data.items()
            }
            # .create() goes through save(), which fills in search_name and discount_price.
            Product.objects.create(**fields)
            created += 1

        self.stdout.write(f'[seed] products: {created} created, {skipped} already present')
