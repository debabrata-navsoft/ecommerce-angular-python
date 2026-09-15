import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { Rating } from '../../../utils/rating.util';
import { Error } from '../../../components/error/error';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { Highlight } from '../../../directives/highlight';
import { WishlistService } from '../../../services/wishlist.service';
import { AuthService } from '../../../services/auth-user.service';
import { LoaderService } from '../../../services/loader.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { CATEGORIES } from '../../../data/category.data';
import { CategoryLabelPipe } from '../../../pipes/category-label.pipe';

@Component({
  selector: 'app-product-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TruncatePipe, Highlight, Error, MatIcon, CategoryLabelPipe],
  templateUrl: './product-list-page.html',
  styleUrl: './product-list-page.css',
})
export class ProductListPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private wishlistService = inject(WishlistService);
  private destroyRef = inject(DestroyRef);
  private loaderService = inject(LoaderService);
  private snackBar = inject(SnackbarService);

  showCategories = input(true);
  showWishlistIcon = input(true);
  // @Input() showCategories = true; // old version
  // @Input() showWishlistIcon = true;  // old version

  private products = signal<Product[]>([]);
  errorMsg = signal(false);
  // searchTerm = signal('');
  minDiscount = signal(0);
  selectedCategory = signal('all');
  selectedMainCategory = signal('all');
  isLatest = signal(false);

  categories = computed(() => {
    const mainCat = this.selectedMainCategory();

    const filtered =
      mainCat === 'all'
        ? this.products()
        : this.products().filter((p) => p.category?.toLowerCase().trim() === mainCat);

    const subCats = filtered
      .map((p) => p.subCategory?.toLowerCase().trim())
      .filter(Boolean) as string[];

    const unique = Array.from(new Set(subCats));

    return ['all', ...unique.sort((a, b) => a.localeCompare(b))];
  });

  filteredProducts = computed(() => {
    // const search = this.searchTerm().toLowerCase();
    const mainCat = this.selectedMainCategory();
    const subCat = this.selectedCategory();
    const discount = this.minDiscount();
    const latest = this.isLatest();

    let result = this.products().filter((product) => {
      // const matchesSearch = product.title.toLowerCase().includes(search);

      const matchesMain = mainCat === 'all' || product.category?.toLowerCase().trim() === mainCat;

      const matchesSub = subCat === 'all' || product.subCategory?.toLowerCase().trim() === subCat;

      const matchesDiscount = (product.discount ?? 0) >= discount;

      return matchesMain && matchesSub && matchesDiscount;
    });

    // matchesSearch &&

    if (latest) {
      result = [...result]
        .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 10);
    }

    return result;
  });

  ngOnInit(): void {
    this.loaderService.show();

    const paramSub = this.route.queryParams.subscribe((params) => {
      this.selectedMainCategory.set((params['main'] || 'all').toLowerCase().trim());
      this.selectedCategory.set((params['category'] || 'all').toLowerCase().trim());
      this.minDiscount.set(params['discount'] ? Number(params['discount']) : 0);
      this.isLatest.set(params['latest'] === 'true');
    });

    this.destroyRef.onDestroy(() => {
      paramSub.unsubscribe();
    });

    const productSub = this.productService.getProducts().subscribe({
      next: (res: Product[]) => {
        this.products.set(
          [...res].sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
        );
        this.loaderService.hide();
      },
      error: (err) => {
        this.errorMsg.set(true);
        this.loaderService.hide();
        console.error(err);
      },
    });

    this.destroyRef.onDestroy(() => {
      productSub.unsubscribe();
    });
  }

  getSubCategoryLabel(slug: string): string {
    if (slug === 'all') return 'All';

    for (const cat of CATEGORIES) {
      const found = cat.subcategories.find((sub) => sub.slug === slug);
      if (found) return found.label;
    }

    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  goToMainCategory(cat: string) {
    const lower = cat.toLowerCase();
    this.selectedMainCategory.set(lower);
    this.selectedCategory.set('all');

    this.router.navigate(['/products'], {
      queryParams: { main: lower, category: 'all' },
    });
  }

  goToSubCategory(sub: string) {
    const lower = sub.toLowerCase();
    this.selectedCategory.set(lower);

    this.router.navigate(['/products'], {
      queryParams: { main: this.selectedMainCategory(), category: lower },
    });
  }

  getDiscountPrice(item: Product): number {
    return this.productService.getDiscountPrice(item);
  }

  isWishlisted(productId: string): boolean {
    return this.authService.isLoggedIn() && this.wishlistService.isInWishlist(productId);
  }

  addToWishlist(product: Product) {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.wishlistService.isInWishlist(product.id!)) {
      this.wishlistService.removeFromWishlist(product.id!);
      this.snackBar.error('Removed from wishlist');
    } else {
      this.wishlistService.addToWishlist(product);
      this.snackBar.success('Added to wishlist');
    }
  }

  viewDetails(id: string) {
    this.router.navigate(['/products', id]);
  }

  getRating() {
    return Rating;
  }

  get currentSelectedCategory() {
    return this.selectedCategory();
  }
  set currentSelectedCategory(val: string) {
    this.selectedCategory.set(val);
  }
}

////////////////////////////////////////////////////////////////////////////////
//////////////////////// Not Signal Base Code //////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// import { Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { ActivatedRoute, Router } from '@angular/router';
// import { MatIcon } from '@angular/material/icon';

// import { ProductService } from '../../../services/product.service';
// import { Product } from '../../../models/product.model';
// import { Rating } from '../../../utils/rating.util';
// import { Error } from '../../../components/error/error';
// import { TruncatePipe } from '../../../pipes/truncate.pipe';
// import { Highlight } from '../../../directives/highlight';
// import { WishlistService } from '../../../services/wishlist.service';
// import { AuthService } from '../../../services/auth-user.service';
// import { LoaderService } from '../../../services/loader.service';
// import { SnackbarService } from '../../../services/snackbar.service';
// import { CATEGORIES } from '../../../data/category.data';

// @Component({
//   selector: 'app-product-list-page',
//   standalone: true,
//   imports: [CommonModule, FormsModule, TruncatePipe, Highlight, Error, MatIcon],
//   templateUrl: './product-list-page.html',
//   styleUrl: './product-list-page.css',
// })
// export class ProductListPage implements OnInit {
//   private authService = inject(AuthService);
//   private router = inject(Router);
//   private route = inject(ActivatedRoute);
//   private productService = inject(ProductService);
//   private wishlistService = inject(WishlistService);
//   private destroyRef = inject(DestroyRef);
//   private loaderService = inject(LoaderService);
//   private snackBar = inject(SnackbarService);

//   @Input() showCategories = true;
//   @Input() showWishlistIcon = true;

//   products: Product[] = [];
//   errorMsg = false;
//   searchTerm = '';
//   minDiscount = 0;
//   selectedCategory = 'all';
//   selectedMainCategory = 'all';

//   ngOnInit(): void {
//     this.loaderService.show();

//     const paramSub = this.route.queryParams.subscribe((params) => {
//       this.selectedMainCategory = (params['main'] || 'all').toLowerCase().trim();
//       this.selectedCategory = (params['category'] || 'all').toLowerCase().trim();
//       this.minDiscount = params['discount'] ? Number(params['discount']) : 0;
//     });

//     this.destroyRef.onDestroy(() => paramSub.unsubscribe());

//     const productSub = this.productService.getProducts().subscribe({
//       next: (res: Product[]) => {
//         this.products = [...res].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

//         this.loaderService.hide();
//       },
//       error: (err) => {
//         this.errorMsg = true;
//         this.loaderService.hide();
//         console.log(err);
//       },
//     });

//     this.destroyRef.onDestroy(() => {
//       productSub.unsubscribe();
//     });
//   }

//   getCategories(): string[] {
//     const filtered =
//       this.selectedMainCategory === 'all'
//         ? this.products
//         : this.products.filter(
//             (p) => p.category?.toLowerCase().trim() === this.selectedMainCategory,
//           );

//     const subCats = filtered.map((p) => p.subCategory?.toLowerCase().trim()).filter(Boolean);

//     const unique = Array.from(new Set(subCats)) as string[];

//     return ['all', ...unique.sort((a, b) => a.localeCompare(b))];
//   }

//   getSubCategoryLabel(slug: string): string {
//     if (slug === 'all') return 'All';

//     for (const cat of CATEGORIES) {
//       const found = cat.subcategories.find((sub) => sub.slug === slug);
//       if (found) return found.label;
//     }

//     return slug.charAt(0).toUpperCase() + slug.slice(1);
//   }

//   getFilteredProducts(): Product[] {
//     const search = this.searchTerm.toLowerCase();

//     return this.products.filter((product) => {
//       const matchesSearch = product.title.toLowerCase().includes(search);

//       const matchesMain =
//         this.selectedMainCategory === 'all' ||
//         product.category?.toLowerCase().trim() === this.selectedMainCategory;

//       const matchesSub =
//         this.selectedCategory === 'all' ||
//         product.subCategory?.toLowerCase().trim() === this.selectedCategory;

//       const matchesDiscount = (product.discount || 0) >= this.minDiscount;

//       return matchesSearch && matchesMain && matchesSub && matchesDiscount;
//     });
//   }

//   goToMainCategory(cat: string) {
//     this.selectedMainCategory = cat.toLowerCase();
//     this.selectedCategory = 'all';

//     this.router.navigate(['/products'], {
//       queryParams: {
//         main: this.selectedMainCategory,
//         category: 'all',
//       },
//     });
//   }

//   goToSubCategory(sub: string) {
//     this.selectedCategory = sub.toLowerCase();

//     this.router.navigate(['/products'], {
//       queryParams: {
//         main: this.selectedMainCategory,
//         category: this.selectedCategory,
//       },
//     });
//   }

//   getDiscountPrice(item: Product): number {
//     return this.productService.getDiscountPrice(item);
//   }

//   isWishlisted(productId: string): boolean {
//     return this.authService.isLoggedIn() && this.wishlistService.isInWishlist(productId);
//   }

//   addToWishlist(product: Product) {
//     if (!this.authService.isLoggedIn()) {
//       this.router.navigate(['/login']);
//       return;
//     }

//     if (this.wishlistService.isInWishlist(product.id!)) {
//       this.wishlistService.removeFromWishlist(product.id!);
//       this.snackBar.error('Removed from wishlist');
//     } else {
//       this.wishlistService.addToWishlist(product);
//       this.snackBar.success('Added to wishlist');
//     }
//   }

//   viewDetails(id: string) {
//     this.router.navigate(['/products', id]);
//   }

//   getRating() {
//     return Rating;
//   }
// }
