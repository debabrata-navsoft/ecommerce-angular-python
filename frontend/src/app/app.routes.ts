import { Routes } from '@angular/router';

import { HomePage } from './pages/home-page/home-page';
import { LoginPage } from './pages/auth/login-page/login-page';
import { SignupPage } from './pages/auth/signup-page/signup-page';
import { NotFound } from './components/not-found/not-found';
import { ProductListPage } from './pages/products/product-list-page/product-list-page';
import { authGuard } from './guards/auth-guard';
import { AboutPage } from './pages/about-page/about-page';
import { ContactPage } from './pages/contact-page/contact-page';
import { ProfilePage } from './pages/account/profile-page/profile-page';
import { CustomerLayout } from './layouts/customer-layout/customer-layout';
import { CartPage } from './pages/cart/cart-page/cart-page';
import { ShippingInfo } from './pages/shipping-info/shipping-info';

export const routes: Routes = [
  {
    path: '',
    component: CustomerLayout,
    children: [
      {
        path: '',
        component: HomePage,
      },

      {
        path: 'account',
        component: ProfilePage,
        canActivate: [authGuard],
        data: { breadcrumb: 'Profile' },
      },

      {
        path: 'about',
        component: AboutPage,
        data: { breadcrumb: 'About' },
      },

      {
        path: 'contact',
        component: ContactPage,
        data: { breadcrumb: 'Contact' },
      },

      {
        path: 'shipping-info',
        component: ShippingInfo,
        data: { breadcrumb: 'Shipping-Info' },
      },

      {
        path: 'login',
        canActivate: [authGuard],
        component: LoginPage,
        data: { hideLayout: true },
      },

      {
        path: 'signup',
        component: SignupPage,
        canActivate: [authGuard],
        data: { hideLayout: true },
      },

      {
        path: 'products',
        data: { breadcrumb: 'Products' },
        children: [
          {
            path: '',
            component: ProductListPage,
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./pages/products/product-detail-page/product-detail-page').then(
                (m) => m.ProductDetailPage,
              ),
          },
        ],
      },

      {
        path: 'deals/today',
        data: { breadcrumb: 'Today Deals' },
        loadComponent: () =>
          import('./pages/sidebar/today-deals/today-deals').then((m) => m.TodayDeals),
      },
      {
        path: 'deals/best-sellers',
        data: { breadcrumb: 'Best Sellers' },
        loadComponent: () =>
          import('./pages/sidebar/best-sellers/best-sellers').then((m) => m.BestSellers),
      },
      {
        path: 'deals/new-arrivals',
        data: { breadcrumb: 'New Arrivals' },
        loadComponent: () =>
          import('./pages/sidebar/new-arrivals/new-arrivals').then((m) => m.NewArrivals),
      },
      {
        path: 'deals/trending',
        data: { breadcrumb: 'Trending Products' },
        loadComponent: () =>
          import('./pages/sidebar/trending-products/trending-products').then(
            (m) => m.TrendingProducts,
          ),
      },

      {
        path: 'cart',
        canActivate: [authGuard],
        data: { breadcrumb: 'Cart' },
        children: [
          {
            path: '',
            component: CartPage,
          },
          {
            path: 'checkout',
            loadComponent: () =>
              import('./pages/cart/checkout/checkout-page/checkout-page').then(
                (m) => m.CheckoutPage,
              ),
            data: { breadcrumb: 'Checkout' },
          },

          {
            path: 'payment',
            loadComponent: () =>
              import('./pages/cart/payment-page/payment-page').then((m) => m.PaymentPage),

            data: { breadcrumb: 'Payment' },
          },

          {
            path: 'order-success/:id',
            loadComponent: () =>
              import('./pages/cart/order-success-page/order-success-page').then(
                (m) => m.OrderSuccessPage,
              ),
            data: { breadcrumb: 'Order Success' },
          },
        ],
      },

      {
        path: 'wishlist',
        loadComponent: () =>
          import('./pages/wishlist-page/wishlist-page').then((m) => m.WishlistPage),
        canActivate: [authGuard],
        data: { breadcrumb: 'Wishlist' },
      },
    ],
  },

  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
  },

  {
    path: '**',
    component: NotFound,
    data: { hideLayout: true, hideBreadcrumb: true },
  },
];
