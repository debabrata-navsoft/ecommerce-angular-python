import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];

// import { RenderMode, ServerRoute } from '@angular/ssr';

// export const serverRoutes: ServerRoute[] = [
//   { path: '', renderMode: RenderMode.Prerender },
//   { path: 'login', renderMode: RenderMode.Prerender },
//   { path: 'signup', renderMode: RenderMode.Prerender },
//   { path: 'about', renderMode: RenderMode.Prerender },
//   { path: 'contact', renderMode: RenderMode.Prerender },
//   { path: 'products', renderMode: RenderMode.Prerender },
//   { path: 'products/:id', renderMode: RenderMode.Server },

//   // Protected — client only
//   { path: 'cart', renderMode: RenderMode.Client },
//   { path: 'cart/checkout', renderMode: RenderMode.Client },
//   { path: 'cart/payment', renderMode: RenderMode.Client },
//   { path: 'cart/order-success/:id', renderMode: RenderMode.Client },
//   { path: 'wishlist', renderMode: RenderMode.Client },
//   { path: 'account', renderMode: RenderMode.Client },
//   { path: 'admin', renderMode: RenderMode.Client },

//   { path: '**', renderMode: RenderMode.Server },
// ];

// import { RenderMode, ServerRoute } from '@angular/ssr';

// export const serverRoutes: ServerRoute[] = [
//   // Public static pages
//   {
//     path: '',
//     renderMode: RenderMode.Prerender,
//   },
//   {
//     path: 'login',
//     renderMode: RenderMode.Prerender,
//   },
//   {
//     path: 'signup',
//     renderMode: RenderMode.Prerender,
//   },
//   {
//     path: 'about',
//     renderMode: RenderMode.Prerender,
//   },
//   {
//     path: 'contact',
//     renderMode: RenderMode.Prerender,
//   },
//   {
//     path: 'products',
//     renderMode: RenderMode.Prerender,
//   },
//   {
//     path: 'products/:id',
//     renderMode: RenderMode.Server, // dynamic, can't prerender
//   },

//   // Protected routes — client only (won't appear in page source)
//   {
//     path: 'cart',
//     renderMode: RenderMode.Client,
//   },
//   {
//     path: 'cart/checkout',
//     renderMode: RenderMode.Client,
//   },
//   {
//     path: 'cart/payment',
//     renderMode: RenderMode.Client,
//   },
//   {
//     path: 'cart/order-success/:id',
//     renderMode: RenderMode.Client,
//   },
//   {
//     path: 'wishlist',
//     renderMode: RenderMode.Client,
//   },
//   {
//     path: 'account',
//     renderMode: RenderMode.Client,
//   },

//   {
//     path: '**',
//     renderMode: RenderMode.Server,
//   },
// ];
