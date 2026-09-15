# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Two packages: the Angular app at the root and the API in `server/` (its own
`package.json`, its own `node_modules`). Both must be running for the app to work.

```bash
# Angular app (root)
npm start                        # dev server on http://localhost:4200 (SSR dev-server)
npm run build                    # production build -> dist/ecommerce-ssr/{browser,server}
npm run watch                    # rebuild on change, development configuration
npm test                         # Karma + Jasmine, watch mode in Chrome
npm run serve:ssr:ecommerce-ssr  # run the built SSR server (node dist/ecommerce-ssr/server/server.mjs)

# API (server/)
cd server
npm run dev                      # node --watch, http://localhost:5000
npm start                        # plain node
npm run seed                     # admin user + 36 sample products + indexes
npm run seed:reset               # wipe products/carts/wishlists/saved-later/orders first
```

Run a single test: Karma has no `--grep` flag here. Either temporarily change `describe`/`it` to `fdescribe`/`fit`, or scope by file:

```bash
ng test --include='**/loader.spec.ts'
ng test --watch=false --browsers=ChromeHeadless   # single CI-style run
```

There is no linter configured. Formatting is Prettier via the `prettier` key in `package.json` (100 cols, single quotes, `angular` parser for `.html`); `server/package.json` carries the same Prettier settings.

## Architecture

Angular 20 standalone-component app with SSR (`@angular/ssr` + Express) talking to a
**Node.js + Express 5 + MongoDB (Mongoose) API in `server/`**. Components talk to
services, and services talk to that API over `HttpClient`.

Firebase is gone — no Firestore, no Firebase Auth, no `@angular/fire` dependency. If you
find Firebase references, they are stale.

See `server/README.md` for the full endpoint list. The backend is plain ESM JavaScript
(`"type": "module"`), no build step.

### The API client layer

- `src/app/core/api.service.ts` — thin `HttpClient` wrapper. Prefixes `environment.apiUrl`,
  sets `withCredentials: true` on **every** call (the session is an httpOnly cookie, so
  there is no token to attach by hand), and unwraps the API's `{ message, details }` error
  envelope into a plain `Error`. Also exposes `isBrowser`.
  During SSR it forwards the incoming request's `Cookie` header (via the `REQUEST` token)
  and resolves a relative `apiUrl` against the request origin.
  The same file exports `fireAndShare()`, which starts a request immediately while keeping
  it subscribable. **Required for any fire-and-forget mutation**; see the cold-observable
  gotcha below.
- `src/app/core/session.service.ts` — owns the signed-in user; the replacement for
  Firebase's `authState`. Both `AuthService` and `AdminAuthService` read from it, so the
  session resolves **once** rather than once per service.

`SessionService`'s subject starts as `undefined` meaning "not resolved yet", and `user$`
filters that out. **This is load-bearing and must not be simplified to a plain
`BehaviorSubject<User | null>`**: the guards do `user$.pipe(take(1))`, and without the
withheld first emission a hard refresh would see a premature `null` and bounce a
signed-in user to `/login`. It reproduces the guarantee `authState` used to provide.

### Rendering / SSR

- `src/main.ts` (browser) and `src/main.server.ts` (server) both bootstrap `App` from `src/app/app.ts`.
- `src/app/app.config.ts` is the shared provider set (router, hydration with event replay, HttpClient with fetch). `app.config.server.ts` merges server rendering on top.
- `src/app/app.routes.server.ts` currently renders **everything** with `RenderMode.Server` (`path: '**'`). Commented-out blocks in that file show an intended per-route prerender/client split — treat those as unimplemented ideas, not active config.
- `src/server.ts` serves `dist/.../browser` statically and delegates everything else to `AngularNodeAppEngine`. It also exports `reqHandler` for Firebase Cloud Functions (a leftover — nothing deploys there now).
- **`security.allowedHosts` in `angular.json` gates SSR.** The list is baked into `dist/.../server/angular-app-engine-manifest.mjs` at build time. Any `Host`/`X-Forwarded-Host` not on it gets a **400** — note that an *empty* list is not "allow all", it rejects everything and silently degrades to client-side rendering. Add a new deployment domain either there (requires rebuild) or via the `NG_ALLOWED_HOSTS` env var, which is comma-separated and merges with the baked list at runtime. `*.example.com` matches subdomains only, never the apex; `"*"` allows everything and logs a startup warning.

Because every route renders on the server, browser-only code still needs guarding — but
the rules changed:

- **`runInInjectionContext(this.injector, () => ...)` is no longer needed anywhere.** It
  existed only because AngularFire required it. Do not reintroduce it.
- Public reads (products) **do** run during SSR and are no longer short-circuited to
  `EMPTY`. `/products` and `/products/:id` genuinely render their data server-side now.
- **The server render is session-aware.** `ApiService` forwards the visitor's `Cookie`, so
  `SessionService`, `CartService`, `WishlistService` and `SaveLaterService` all load on the
  server too. Do not reintroduce `if (!api.isBrowser) return` in those loaders — that is
  what made a refresh render a logged-in user as logged out.
- Angular's HTTP transfer cache carries those SSR responses into the browser, so the client
  resolves the same session without a second round trip. That also keeps the client's
  initial state identical to the server's, which is what stops the `@if (authReady)` block
  in `header.html` from tripping a hydration mismatch.
- Guards still return `of(true)` on the server — routing decisions stay client-side.
- `/cart` and `/wishlist` render a spinner server-side regardless, because those page
  components gate their content on `afterNextRender`, which never runs during SSR. Same for
  the homepage's `isPlatformBrowser` early return. Those are component-level choices, not
  data-layer limits.

The SSR server calls the API server-to-server, forwarding the cookie but sending no
`Origin` header, which `server/src/server.js` allows explicitly. Keep that branch when
touching CORS.

### Routing and layouts

Two route trees, both lazily composed:

- `src/app/app.routes.ts` — customer area, wrapped in `CustomerLayout`.
- `src/app/admin/admin.routes.ts` — lazy-loaded at `/admin`, wrapped in `AdminLayout`, every route behind `adminAuthGuard`.

Route `data` drives layout chrome. `CustomerLayout` walks the activated-route tree on each `NavigationEnd` and reads:

- `hideLayout: true` — suppress header + footer (used by login/signup/404)
- `hideBreadcrumb: true` — suppress the breadcrumb bar
- `breadcrumb: 'Label'` — static breadcrumb segment

`Breadcrumb` builds crumbs from these `data.breadcrumb` values, and for `/products/:id` it additionally fetches the product to append category/subcategory crumbs that link back to `/products` with query params.

The product catalog is query-param driven, not route driven. `/products` reads `main`, `category`, `discount`, and `latest` from `queryParams` and filters a signal-backed list with `computed()`. Category pages under `src/app/components/categories/**` are thin carousel components that call `productService.getProductsByCategory(slug)`; they do not have their own routes.

### Auth: two parallel identities on one API

Roles live on the Mongo user document (`role: 'user' | 'admin'`), not in a token claim —
`authenticate` re-reads the user on every request, so a role change or deletion takes
effect immediately rather than when the token expires.

The session is a **httpOnly cookie** (`access_token`), unreachable from JS.

Two services and two guards, deliberately kept separate:

- `AuthService` (`services/auth-user.service.ts`) + `authGuard` — customer side.
- `AdminAuthService` (`services/auth-admin.service.ts`) + `adminAuthGuard` — admin side.

The role check is now enforced **server-side**: `POST /api/auth/login` accepts only
`role: 'user'` and `POST /api/auth/admin/login` accepts only `role: 'admin'`, each
refusing the other. Calling the API directly cannot bypass it, which the old
client-side check could not promise.

Both still write `localStorage.session_role`. Because one cookie is shared across tabs, a
session can still leak between the customer and admin areas, so each guard checks *both*
the role on the session user and `session_role`, and bounces to the matching login page.
**Keep that dual check intact when touching guards.**

Both services expose `currentUser$: Observable<User | null>`, sourced from
`SessionService.user$`. `AuthService` also exposes `currentUser` (signal) and
`isAuthReady` for templates.

`authGuard` is also applied to `/login` and `/signup`, where it allows anonymous visitors through and redirects already-logged-in users away. On rejection it stashes the target URL in `localStorage.redirectUrl`.

### State: signals in root services, the API as the source of truth

Services are `providedIn: 'root'` and hold state in signals rather than a store library.
`CartService`, `WishlistService`, and `SaveLaterService` all follow the same shape:

1. Constructor subscribes to `SessionService.user$` — on login call `loadX()`, on logout reset the signal to `[]`.
2. `loadX()` GETs the list and sets the signal. Runs on the server too.
3. Mutations update the signal optimistically *and* fire the request, so the UI does not wait on the round-trip.
4. Derived values (`itemCount`, `totalPrice`) are `computed()`.

The difference from the Firestore version: **every mutation endpoint returns the full
updated list**, so the optimistic value is reconciled against the server response rather
than assumed correct, and a failed request rolls the signal back instead of leaving the
UI lying. Follow that pattern (`CartService.commit()`) for new mutations.

Subscriptions in these services are cleaned up with `inject(DestroyRef)`; the old
Firestore versions leaked their `authState` subscription.

### MongoDB collections

```
users             # profile, passwordHash (select:false), role, addresses[]
products
cartitems         # { userId, productId, quantity }, unique (userId, productId)
wishlistitems     # same shape
savedlateritems   # same shape
orders            # embedded item snapshots + address; indexed { userId, createdAt }
```

Cart, wishlist and saved-later store **only a product reference** and resolve it with
`populate` on read, so a price or stock edit shows up in every list at once. Orders are
the deliberate exception: they embed a frozen snapshot, because an order's prices must not
follow later product edits. All three lists share one schema factory
(`server/src/models/line-item.model.js`).

Orders are written **once**. Firestore needed the `orders/{id}` mirror of
`users/{uid}/orders/{id}` so admins could query them all; one indexed collection now
serves both the customer history and the admin list.

Two distinct order states, per `models/payment.model.ts`: `status` is fulfilment
(pending/shipped/delivered/cancelled) and `paymentStatus` is payment
(pending/paid/confirmed/failed).

### Checkout flow

`/cart` → `/cart/checkout` → `/cart/payment` → `/cart/order-success/:id`.

`CheckoutPage` collects the address and totals, then navigates to `/cart/payment` passing the payload through **router navigation state**, not a service. `PaymentPage` reads it in its constructor via `router.currentNavigation()?.extras?.state` and redirects home with a "Session expired" message if absent — so the payment page cannot be deep-linked or reloaded. `CheckoutPage` also has an `effect()` that bounces to `/` if the cart empties, explicitly skipped while on the payment URL and after `orderPlaced` is set.

The payment sequence is **order → pay → verify**:

1. `POST /api/orders` with `{ address, shippingMethod, paymentMethod }` only. The API
   builds the order from **its own** view of the cart and recomputes the totals, so a
   crafted request cannot set its own `total`. It returns the order plus a Razorpay
   `{ keyId, orderId, amount, currency }`.
2. `RazorpayService.openPayment` opens the checkout bound to that server-side `order_id`.
3. `POST /api/payments/:orderId/verify` recomputes the HMAC over `<order_id>|<payment_id>`
   with the secret and only then marks the order `paid`.

This inverts the old flow, which paid first and then created the order from a
browser-supplied `razorpay_payment_id` that nothing verified. **Do not move order
creation back after payment.**

Dismissing the modal or a failed payment calls `POST /api/payments/:orderId/abandon`,
which releases the stock the order reserved. `'cod'` skips Razorpay entirely and is
written `paymentStatus: 'confirmed'`.

Totals live in `server/src/services/pricing.js` and are mirrored for display in
`checkout-page.ts`: `gst = subTotal * 0.18`, `express` shipping = 90, `free` = 0. Change
both or they drift.

### Cross-cutting UI services

- `LoaderService` — a single global `isLoading` signal. Components call `show()`/`hide()` around async work and bind `isLoading` to a local `<app-loader>`; `App` also renders one globally.
- `SnackbarService` — wraps `MatSnackBar` with `success()`/`error()`, top-center, `snackbar-success`/`snackbar-error` panel classes.

## Conventions

- **File and class naming follows the Angular 20 style with no type suffix**: `product-list-page.ts` exports `ProductListPage`, `cart.service.ts` exports `CartService`. Do not add `.component.ts`. Templates and styles are separate files (`templateUrl`/`styleUrl`), CSS not SCSS — `src/custom-theme.scss` is the only SCSS file (Angular Material theme).
- All components are `standalone: true` with explicit `imports`. Dependencies use `inject()`, not constructor parameters.
- Templates use the built-in control flow (`@if`, `@for`), not `*ngIf`/`*ngFor`.
- Subscriptions are cleaned up with `inject(DestroyRef).onDestroy(() => sub.unsubscribe())` rather than `ngOnDestroy`.
- TypeScript is `strict` with `noPropertyAccessFromIndexSignature`, so index-signature access is bracketed: `err.error?.['message']`.  `strictTemplates` is on.
- Shared helpers live in `pipes/` (`truncate`, `time-ago`, `category-label`), `directives/highlight.ts`, and `utils/rating.util.ts`. Category taxonomy is a static list in `data/category.data.ts` — subcategory slugs there must match the `subCategory` values stored on product documents, since filtering compares them lowercased. `server/src/seed/products.data.js` uses those same slugs.
- Backend: `server/src/server.js` is the single entry point — it builds the app (exported as
  `createApp()` so it can be mounted in a test without opening a port) and starts it.
  Controllers stay thin and delegate to `server/src/services/*`. Route files own validation via
  `express-validator` chains plus the shared `validate` middleware. Throw `ApiError.*` rather
  than crafting responses; the error handler renders the envelope.
- **Handlers are plain `async function`s with no try/catch wrapper.** Express 5 forwards a
  rejected promise to the error handler itself, so there is no `asyncHandler`. Do not add one.
- Shared serialization lives in `utils/mongoose-json.js` (`serializeJson` for schemas,
  `serializeLean` for aggregation results) and paging in `utils/paginate.js`. Reuse them
  instead of hand-writing a `toJSON` transform or re-deriving page/limit.

## Gotchas

- **HttpClient observables are cold; the Firestore code they replaced was eager.**
  `from(setDoc(...))` had already started the write before anyone subscribed, so call sites
  were written as `service.doThing()` with no `.subscribe()`. Returning a plain cold
  observable from such a method means **the request is never sent** — the optimistic signal
  update still paints the UI, so it looks like it worked until the next load. This is what
  made added wishlist items vanish on refresh and left `logout()` never clearing the
  cookie. Wrap fire-and-forget mutations in `fireAndShare()` (or subscribe internally and
  return `void`). Only leave a mutation cold if every caller subscribes, as login/signup do.
- The SSR HTML is **user-specific**: it reflects the visitor's session and the transfer
  cache embeds their user object. `src/server.ts` sets `Cache-Control: no-store, private`
  and `Vary: Cookie` on it for that reason — a shared cache would serve one visitor's
  account to another. Static assets under `/browser` keep their 1-year cache.
- `server/.env` is gitignored and is the file the server loads; `server/.env.example` is the committed template. **Never put real credentials in `.env.example`.**
- `server/src/config/env.js` resolves `.env` from the package root via `import.meta.url`, not `process.cwd()`, so scripts work from any directory. Do not switch it back to `import 'dotenv/config'`.
- `JWT_SECRET` is required — the API refuses to boot without it. A short or guessable value lets anyone mint a `role=admin` token.
- `RAZORPAY_KEY_SECRET` is **not** the same string as `RAZORPAY_KEY_ID`. Using the key id as the secret makes every signature verification fail. Without both, `/api/payments/*` returns 503 and only `cod` orders work.
- `SEED_ADMIN_EMAIL` must be a real email address; every login route validates the field as one, so a bare username creates an account that can never sign in. The seed fails fast on this.
- `MONGODB_URI` must include the database name in the path or the driver silently uses `test`.
- Transactions need a replica set. `withTransaction` falls back to sequential writes on a standalone `mongod`, so multi-document operations are **not** atomic locally even though they are on Atlas. `reserveStock` unwinds by hand to cover that.
- `src/environments/environment.ts` and `environment.prod.ts` now differ (`apiUrl`), but `angular.json` still defines no `fileReplacements`, so the prod file is **never used** — `environment.ts` is what ships. Add a `fileReplacements` entry before relying on it.
- `CORS_ORIGINS` must list the Angular origin: credentialed requests cannot use a wildcard. Requests with no `Origin` (the SSR server, curl) are allowed on purpose.
- The `Dockerfile` CMD still says `dist/<your-app-name>/server/server.mjs`; the real path is `dist/ecommerce-ssr/server/server.mjs`. It also does not build or run `server/`. The image will not start as written.
- `firebase.json` is empty (`{}`) and `src/server.ts` still exports `reqHandler` for Cloud Functions — both are leftovers from the Firebase backend.
- Several files carry large commented-out earlier revisions (`app.routes.server.ts`, `product-list-page.ts`, `payment-page.ts` predecessors). Read past them; do not treat them as reference implementations.
- Two unrelated components are both named `TodayDeals` (`components/categories/today-deals/` and `pages/sidebar/today-deals/`). Check the import path.
- Addresses are keyed by **id**, not array index. The old code replaced the whole `addresses` array, which dropped any address added in another tab between read and write.
- `CartService.saveForLater()` now does the whole move in one request (`POST /api/cart/:productId/save-for-later`). Callers must **not** also call `removeItem()` — that was the old two-call requirement and it lost items when only half ran.
- Test coverage is two spec files (`app.spec.ts`, `loader.spec.ts`); there is no established testing pattern for the API-backed services, and the backend has no tests yet.
