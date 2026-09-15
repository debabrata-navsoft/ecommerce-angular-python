import { Component, OnDestroy, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, switchMap, of, Subscription, startWith } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { CATEGORIES } from '../../data/category.data';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css',
})
export class Breadcrumb implements OnInit, OnDestroy {
  breadcrumbs: {
    label: string;
    url: string;
    queryParams?: Record<string, string>;
  }[] = [];

  private sub: Subscription | null = null;
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);

  ngOnInit() {
    // if (!isPlatformBrowser(this.platformId)) return;

    this.sub = this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        startWith(null),
        switchMap(() => {
          const base = this.buildBase();

          if (!base.productId) {
            return of({ base, post: null });
          }

          return this.productService
            .getProductById(base.productId)
            .pipe(switchMap((post) => of({ base, post })));
        }),
      )
      .subscribe(({ base, post }) => {
        this.breadcrumbs = [...base.staticCrumbs];

        if (post) {
          const mainCat = post.category?.toLowerCase().trim();
          if (mainCat) {
            this.breadcrumbs.push({
              label: this.toLabel(mainCat),
              url: '/products',
              queryParams: { main: mainCat, category: 'all' },
            });
          }

          const subCat = post.subCategory?.toLowerCase().trim();
          if (subCat) {
            this.breadcrumbs.push({
              label: this.toLabel(subCat),
              url: '/products',
              queryParams: { main: mainCat, category: subCat },
            });
          }

          const shortTitle = post.title.length > 25 ? post.title.slice(0, 25) + '...' : post.title;

          this.breadcrumbs.push({
            label: shortTitle,
            url: `/products/${base.productId}`,
          });
        } else {
          const { main, sub, latest, discount } = base;

          // if (this.router.url.startsWith('/products')) {
          //   // Only add if not already present
          //   if (!this.breadcrumbs.some((b) => b.label === 'Products')) {
          //     this.breadcrumbs.push({ label: 'Products', url: '/products' });
          //   }
          // }

          if (this.router.url === '/products') {
            this.breadcrumbs.push({ label: 'All Products', url: '/products' });
            return;
          }

          if (discount) {
            this.breadcrumbs.push({
              label: 'Discount',
              url: '/products',
              queryParams: { latest: 'true' },
            });
            return;
          }

          if (latest) {
            this.breadcrumbs.push({
              label: 'Trending',
              url: '/products',
              queryParams: { latest: 'true' },
            });
            return;
          }

          if (main && main !== 'all') {
            this.breadcrumbs.push({
              label: this.toLabel(main),
              url: '/products',
              queryParams: { main },
            });
          }

          if (sub && sub !== 'all') {
            this.breadcrumbs.push({
              label: this.toLabel(sub),
              url: '/products',
              queryParams: { main: main ?? undefined, category: sub },
            });
          }
        }
      });
  }

  private buildBase() {
    if (this.router.url === '/' || this.router.url === '') {
      return {
        staticCrumbs: [],
        productId: null,
        main: null,
        sub: null,
        latest: false,
        discount: null,
      };
    }

    const staticCrumbs: { label: string; url: string; queryParams?: Record<string, string> }[] = [
      { label: 'Home', url: '/' },
    ];

    let currentRoute = this.route.root;
    let url = '';

    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
      const routeURL = currentRoute.snapshot.url.map((s) => s.path).join('/');
      if (!routeURL) continue;

      url += `/${routeURL}`;
      const staticLabel = currentRoute.snapshot.data['breadcrumb'];

      if (
        staticLabel &&
        staticLabel !== 'Home' &&
        staticLabel !== 'Products' &&
        !staticCrumbs.some((b) => b.label === staticLabel)
      ) {
        staticCrumbs.push({ label: staticLabel, url });
      }
    }

    let deepest = this.route.snapshot;
    while (deepest.firstChild) deepest = deepest.firstChild;

    const productId = deepest.params['id'] ?? null;
    const queryParams = deepest.queryParams;
    const main = queryParams['main']?.toLowerCase().trim() ?? null;
    const sub = queryParams['category']?.toLowerCase().trim() ?? null;
    const latest = queryParams['latest'] === 'true';
    const discount = queryParams['discount'] ?? null;

    return { staticCrumbs, productId, main, sub, latest, discount };
  }

  // private toLabel(s: string): string {
  //   if (s === 'all') return 'All';

  //   // Search in main categories
  //   for (const cat of CATEGORIES) {
  //     if (
  //       cat.name.toLowerCase().replace(/\s+/g, '-') === s ||
  //       cat.name.toLowerCase().replace(/[^a-z]/g, '-') === s
  //     ) {
  //       return cat.name; // returns "Home & Living", "Baby & Kids" etc.
  //     }

  //     // Search in subcategories
  //     const sub = cat.subcategories.find((sc) => sc.slug === s);
  //     if (sub) return sub.label;
  //   }

  //   // Fallback: capitalize hyphenated slug
  //   return s
  //     .split('-')
  //     .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  //     .join(' ');
  // }

  private toLabel(value: string): string {
    if (value === 'all') return 'All';

    const normalized = value.toLowerCase().trim();

    // Main category
    const mainCategory = CATEGORIES.find(
      (cat) => cat.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-') === normalized,
    );

    if (mainCategory) {
      return mainCategory.name;
    }

    // Subcategory
    for (const cat of CATEGORIES) {
      const sub = cat.subcategories.find((s) => s.slug === normalized);

      if (sub) {
        return sub.label;
      }
    }

    // fallback
    return normalized
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // private toLabel(s: string): string {
  //   return s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
  // }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}

// import { Component, OnDestroy } from '@angular/core';

// import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
// import { filter, switchMap, of, Subscription, startWith } from 'rxjs';

// import { ProductService } from '../../services/product.service';

// @Component({
//   selector: 'app-breadcrumb',
//   standalone: true,
//   imports: [RouterLink],
//   templateUrl: './breadcrumb.html',
//   styleUrl: './breadcrumb.css',
// })
// export class Breadcrumb implements OnDestroy {
//   breadcrumbs: {
//     label: string;
//     url: string;
//     queryParams?: Record<string, string>;
//   }[] = [];

//   private sub: Subscription;

//   constructor(
//     private router: Router,
//     private route: ActivatedRoute,
//     private productService: ProductService,
//   ) {
//     this.sub = this.router.events
//       .pipe(
//         filter((e) => e instanceof NavigationEnd),
//         startWith(null),
//         switchMap(() => {
//           const base = this.buildBase();

//           if (!base.productId) {
//             return of({ base, post: null });
//           }

//           return this.productService
//             .getProductById(base.productId)
//             .pipe(switchMap((post) => of({ base, post })));
//         }),
//       )
//       .subscribe(({ base, post }) => {
//         this.breadcrumbs = [...base.staticCrumbs];

//         if (post) {
//           const mainCat = post.category?.toLowerCase().trim();
//           if (mainCat) {
//             this.breadcrumbs.push({
//               label: this.toLabel(mainCat),
//               url: '/products',
//               queryParams: { main: mainCat, category: 'all' },
//             });
//           }

//           const subCat = post.subCategory?.toLowerCase().trim();
//           if (subCat) {
//             this.breadcrumbs.push({
//               label: this.toLabel(subCat),
//               url: '/products',
//               queryParams: { main: mainCat, category: subCat },
//             });
//           }

//           const shortTitle = post.title.length > 25 ? post.title.slice(0, 25) + '...' : post.title;

//           this.breadcrumbs.push({
//             label: shortTitle,
//             url: `/products/${base.productId}`,
//           });
//         } else {
//           const { main, sub } = base;

//           if (main && main !== 'all') {
//             this.breadcrumbs.push({
//               label: this.toLabel(main),
//               url: '/products',
//               queryParams: { main },
//             });
//           }

//           if (sub && sub !== 'all') {
//             this.breadcrumbs.push({
//               label: this.toLabel(sub),
//               url: '/products',
//               queryParams: { main: main ?? undefined, category: sub },
//             });
//           }
//         }
//       });
//   }

//   private buildBase() {
//     if (this.router.url === '/' || this.router.url === '') {
//       return { staticCrumbs: [], productId: null, main: null, sub: null };
//     }

//     const staticCrumbs: {
//       label: string;
//       url: string;
//       queryParams?: Record<string, string>;
//     }[] = [{ label: 'Home', url: '/' }];

//     let currentRoute = this.route.root;
//     let url = '';

//     while (currentRoute.firstChild) {
//       currentRoute = currentRoute.firstChild;
//       const routeURL = currentRoute.snapshot.url.map((s) => s.path).join('/');
//       if (!routeURL) continue;

//       url += `/${routeURL}`;
//       const staticLabel = currentRoute.snapshot.data['breadcrumb'];

//       if (
//         staticLabel &&
//         staticLabel !== 'Home' &&
//         !staticCrumbs.some((b) => b.label === staticLabel)
//       ) {
//         staticCrumbs.push({ label: staticLabel, url });
//       }
//     }

//     let deepest = this.route.snapshot;
//     while (deepest.firstChild) deepest = deepest.firstChild;

//     const productId = deepest.params['id'] ?? null;
//     const queryParams = deepest.queryParams;
//     const main = queryParams['main']?.toLowerCase().trim() ?? null;
//     const sub = queryParams['category']?.toLowerCase().trim() ?? null;

//     return { staticCrumbs, productId, main, sub };
//   }

//   private toLabel(s: string): string {
//     return s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
//   }

//   ngOnDestroy() {
//     this.sub.unsubscribe();
//   }
// }

// import { Component } from '@angular/core';
// import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
// import { ProductService } from '../../services/product-service';
// import { filter } from 'rxjs';
// import { CommonModule } from '@angular/common';

// @Component({
//   selector: 'app-breadcrumb',
//   standalone: true,
//   imports: [CommonModule, RouterLink],
//   templateUrl: './breadcrumb.html',
//   styleUrl: './breadcrumb.css',
// })
// export class Breadcrumb {
//   breadcrumbs: {
//     label: string;
//     url: string;
//     queryParams?: Record<string, string>;
//   }[] = [];

//   constructor(
//     private router: Router,
//     private route: ActivatedRoute,
//     private productService: ProductService,
//   ) {
//     this.buildBreadcrumbs();
//     this.router.events
//       .pipe(filter((event) => event instanceof NavigationEnd))
//       .subscribe(() => this.buildBreadcrumbs());
//   }

//   private buildBreadcrumbs() {
//     const currentUrl = this.router.url;

//     if (currentUrl === '/') {
//       this.breadcrumbs = [];
//       return;
//     }

//     this.breadcrumbs = [{ label: 'Home', url: '/' }];

//     let currentRoute = this.route.root;
//     let url = '';

//     while (currentRoute.firstChild) {
//       currentRoute = currentRoute.firstChild;
//       const routeURL = currentRoute.snapshot.url.map((s) => s.path).join('/');
//       if (!routeURL) continue;

//       url += `/${routeURL}`;
//       const staticLabel = currentRoute.snapshot.data['breadcrumb'];

//       if (
//         staticLabel &&
//         staticLabel !== 'Home' &&
//         !this.breadcrumbs.some((b) => b.label === staticLabel)
//       ) {
//         this.breadcrumbs.push({ label: staticLabel, url });
//       }
//     }

//     let deepest = this.route.snapshot;
//     while (deepest.firstChild) deepest = deepest.firstChild;

//     const productId = deepest.params['id'];
//     const isProductPage = !!productId;

//     const queryParams = this.route.snapshot.queryParams;

//     const main = queryParams['main']?.toLowerCase().trim();
//     const sub = queryParams['category']?.toLowerCase().trim();

//     if (!isProductPage && main && main !== 'all') {
//       this.breadcrumbs.push({
//         label: this.toLabel(main),
//         url: '/products',
//         queryParams: { main },
//       });
//     }

//     if (!isProductPage && sub && sub !== 'all') {
//       this.breadcrumbs.push({
//         label: this.toLabel(sub),
//         url: '/products',
//         queryParams: { main, category: sub },
//       });
//     }

//     // const queryParams = this.route.snapshot.queryParams;

//     // if (!isProductPage && queryParams['category']) {
//     //   const category = queryParams['category'].toLowerCase().trim();
//     //   const label = this.toLabel(category);

//     //   this.breadcrumbs.push({
//     //     label,
//     //     url: '/products',
//     //     queryParams: { category },
//     //   });
//     // }

//     if (isProductPage) {
//       const productUrl = `/products/${productId}`;

//       this.productService.getProductById(productId).subscribe((post) => {
//         if (!post) return;

//         const category = post.category?.toLowerCase().trim();

//         if (category) {
//           const label = this.toLabel(category);

//           this.breadcrumbs = this.breadcrumbs.filter(
//             (b) => b.label.toLowerCase() !== label.toLowerCase(),
//           );

//           this.breadcrumbs.splice(2, 0, {
//             label,
//             url: '/products',
//             queryParams: { category },
//           });
//         }

//         const shortTitle = post.title.length > 25 ? post.title.slice(0, 25) + '...' : post.title;

//         this.breadcrumbs = this.breadcrumbs.filter((b) => b.label !== shortTitle);

//         this.breadcrumbs.push({
//           label: shortTitle,
//           url: productUrl,
//         });
//       });
//     }
//   }

//   private toLabel(category: string): string {
//     if (category === 'all') return 'All';
//     return category.charAt(0).toUpperCase() + category.slice(1);
//   }
// }
