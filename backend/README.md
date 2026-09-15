# ecommerce-api (Django)

Python + Django 5 + Django REST Framework + **MySQL** backend for the Angular app in the
parent directory. A port of the Node/Express API in `server/`.

**The HTTP contract is identical** — same paths, same JSON envelopes, same status codes,
same `access_token` httpOnly cookie. The Angular app needs one change to switch over: the
`apiUrl` in `src/environments/environment.ts`.

## Layout

```
backend/
  manage.py
  config/            settings, urls, wsgi/asgi, PyMySQL shim
  api/
    models.py        User, Address, Product, Cart/Wishlist/SavedLater, Order, OrderItem
    serializers.py   read + write serializers (all the camelCase mapping lives here)
    authentication.py  cookie-based JWT
    permissions.py   IsAuthenticated / IsAdmin / IsSelfOrAdmin
    exceptions.py    ApiError + the { message, details } handler
    urls.py
    admin.py
    views/           one module per resource
    services/        pricing, inventory, orders, line_items, razorpay_client
    management/commands/seed.py
    tests/test_api.py   62 tests, port of the Node smoke test
```

Business logic lives in `services/`; views stay thin and mostly validate, delegate and
serialize.

## Setup

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # fill in JWT_SECRET and the DB_* values
python manage.py migrate
python manage.py seed         # admin user + 36 sample products
python manage.py runserver 8000
```

`python manage.py seed --reset` clears products, carts, wishlists, saved-later and orders
first. Re-running the plain seed is safe: it upserts the admin and skips products already
present.

### Point the Angular app at it

```ts
// src/environments/environment.ts
apiUrl: 'http://localhost:8000/api',
```

Nothing else changes. Keep `CORS_ORIGINS` in `.env` matching the Angular origin —
credentialed requests cannot use a wildcard.

### MySQL

Create the database first; Django creates tables but not the schema itself:

```sql
CREATE DATABASE ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then set `DB_ENGINE=mysql` and the `DB_*` values in `.env`.

`requirements.txt` uses **PyMySQL** (pure Python, installs anywhere) with a shim in
`config/__init__.py` that registers it as `MySQLdb`. If you can build `mysqlclient` it is
faster — install it and empty that file.

`DB_ENGINE=sqlite` runs the whole thing without a MySQL server. The test suite uses it:

```bash
DB_ENGINE=sqlite python manage.py test
```

### Environment

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | **Required** — the app refuses to start without it. 48 random bytes; a guessable value lets anyone mint a `role=admin` token. |
| `DJANGO_SECRET_KEY` | Required when `DJANGO_DEBUG=False`. Separate from `JWT_SECRET` so they rotate independently. |
| `DB_ENGINE` | `mysql` (default) or `sqlite`. |
| `CORS_ORIGINS` | Comma-separated. Must list the Angular origin exactly. |
| `RAZORPAY_KEY_ID` / `_SECRET` | Both needed for online payment. Without them `/api/payments/*` returns 503 and only `cod` orders work. The secret is **not** the key id. |
| `SEED_ADMIN_EMAIL` | Must be a real email address — it is the admin login. The seed fails fast otherwise. |

## Endpoints

Identical to `server/README.md`. Summary:

| Group | Paths |
| --- | --- |
| Auth | `POST /api/auth/signup`, `/login`, `/admin/login`, `/logout`, `/change-password` · `GET|PATCH /api/auth/me` |
| Products | `GET /api/products`, `/products/<id>`, `/products/feed/{trending,best-sellers,today-deals,discounted}` · `POST|PATCH|DELETE` admin |
| Users | `GET /api/users` (admin) · `GET|PATCH|DELETE /api/users/<id>` · `PATCH /api/users/<id>/role` (admin) · addresses under `/api/users/<id>/addresses[/<addressId>]` |
| Cart | `GET|POST|DELETE /api/cart` · `PATCH|DELETE /api/cart/<productId>` · `POST /api/cart/<productId>/save-for-later` |
| Wishlist | `GET|POST /api/wishlist` · `DELETE /api/wishlist/<productId>` |
| Saved later | `GET|POST /api/saved-later` · `DELETE /api/saved-later/<productId>` · `POST /api/saved-later/<productId>/move-to-cart` |
| Orders | `GET|POST /api/orders` · `GET /api/orders/all` (admin) · `GET /api/orders/<orderId>` · `POST /api/orders/<orderId>/cancel` · `PATCH /api/orders/<orderId>/status` (admin) |
| Payments | `GET /api/payments/config` · `POST /api/payments/<orderId>/{verify,abandon}` |
| Health | `GET /api/health` |

## Design notes

**Auth.** The session is a httpOnly `access_token` cookie (PyJWT, HS256), unreachable from
JavaScript; `Authorization: Bearer …` also works for non-browser clients. Two login routes
over one credential store — `/auth/login` accepts only `role: 'user'` and
`/auth/admin/login` only `role: 'admin'`, each refusing the other. Every request re-reads
the user, so a role change or deletion takes effect immediately. Passwords use Argon2.

**Order totals are server-computed.** `POST /api/orders` accepts only
`{ address, shippingMethod, paymentMethod }`. Items, prices and totals come from the
user's cart; a client cannot set its own `total`. Figures match `checkout-page.ts`:
`gst = subTotal * 0.18`, express shipping 90, free 0 — in `Decimal`, so they cannot drift.

**Stock is race-safe.** One conditional `UPDATE ... WHERE stock >= n` inside
`transaction.atomic()`, so two shoppers racing for the last unit cannot both succeed.
Unlike the Mongo version there is no non-transactional fallback: MySQL/InnoDB gives real
ACID, so a failed line rolls the whole order back automatically.

**Payments are verified.** Flow is order → pay → verify: the API mints a Razorpay order,
the browser pays against that `order_id`, and `/verify` recomputes the HMAC over
`<order_id>|<payment_id>` with the secret before marking the order paid. A dismissed modal
or failed card calls `/abandon`, which releases the reserved stock.

**Ids are UUIDs, not auto-increment integers.** Ids appear in URLs (`/api/users/<id>`), and
sequential ids would let anyone enumerate every user and order.

**Relational shapes.** What Mongo embedded is now normalised: the user's `addresses[]` is
its own table (so addresses are keyed by id, never array index), and order lines are
`OrderItem` rows. Two deliberate exceptions stay denormalised — the order's delivery
address is a JSON snapshot, and `OrderItem.product_id` is a plain value rather than a
foreign key, so an order survives the product being deleted and its prices never follow
later catalogue edits.

Cart, wishlist and saved-later hold only a product reference and join on read, so a price
or stock edit shows up in every list at once.

**Django admin** is available at `/django-admin/` for the seeded admin user — a bonus the
Node version had no equivalent for.

## Tests

```bash
DB_ENGINE=sqlite python manage.py test
```

62 tests covering the contract (paths, envelopes, epoch-millis timestamps, status codes),
the security properties (server-computed totals, client totals ignored, stock rollback,
role separation, cross-user isolation, no privilege escalation via profile PATCH) and the
feed ranking.

## Two known differences from the Node API

- **A malformed id returns 404, not 400.** Express validated `isMongoId()` and answered
  400; Django's `<uuid:…>` URL converter simply does not match, so the path 404s. Both are
  4xx and `ApiService` handles either.
- **The JSON 404 envelope for unmatched `/api/…` paths only applies when
  `DJANGO_DEBUG=False`.** With debug on, Django's URL-pattern page is shown instead, which
  is more useful while developing.
