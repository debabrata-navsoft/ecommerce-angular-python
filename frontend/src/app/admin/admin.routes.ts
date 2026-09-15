import { Routes } from '@angular/router';

import { AdminLayout } from '../layouts/admin-layout/admin-layout';
import { Dashboard } from './dashboard/dashboard';
import { adminAuthGuard } from '../guards/admin-auth-guard';
import { AdminLoginPage } from './auth/admin-login-page/admin-login-page';

import { UserList } from './users/user-list/user-list';
import { OrderList } from './orders/order-list/order-list';
import { ProductListTable } from './products/product-list-table/product-list-table';

export const adminRoutes: Routes = [
  {
    path: 'login',
    component: AdminLoginPage,
    canActivate: [adminAuthGuard],
  },

  {
    path: '',
    component: AdminLayout,
    canActivate: [adminAuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: Dashboard,
      },

      {
        path: 'users',
        children: [
          { path: '', component: UserList },
          {
            path: ':id',
            loadComponent: () =>
              import('./users/user-detail/user-detail').then((m) => m.UserDetail),
          },
        ],
      },

      {
        path: 'products',
        children: [
          { path: '', component: ProductListTable },
          {
            path: 'add-product',
            loadComponent: () =>
              import('./products/add-product/add-product').then((m) => m.AddProduct),
          },

          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./products/add-product/add-product').then((m) => m.AddProduct),
          },
        ],
      },

      {
        path: 'orders',
        children: [
          { path: '', component: OrderList },
          {
            path: ':id',
            loadComponent: () =>
              import('./orders/order-details/order-details').then((m) => m.OrderDetails),
          },
        ],
      },
    ],
  },
];
