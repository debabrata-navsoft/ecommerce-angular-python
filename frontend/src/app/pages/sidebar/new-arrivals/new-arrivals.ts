import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { AuthService } from '../../../services/auth-user.service';
import { WishlistService } from '../../../services/wishlist.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { Rating } from '../../../utils/rating.util';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { CategoryLabelPipe } from '../../../pipes/category-label.pipe';
import { Highlight } from '../../../directives/highlight';
import { LoaderService } from '../../../services/loader.service';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-new-arrivals',
  standalone: true,
  imports: [CommonModule, MatIconModule, TruncatePipe, CategoryLabelPipe, Highlight, Loader],
  templateUrl: './new-arrivals.html',
  styleUrl: './new-arrivals.css',
})
export class NewArrivals implements OnInit {
  private router = inject(Router);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private wishlistService = inject(WishlistService);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(SnackbarService);
  private loaderService = inject(LoaderService);

  isLoading = this.loaderService.isLoading;

  products = signal<Product[]>([]);
  showWishlistIcon = input(true);
  // @Input() showWishlistIcon = true;  // old version

  ngOnInit(): void {
    this.loaderService.show();

    const productSub = this.productService.getProducts().subscribe({
      next: (res) => {
        const sorted = [...res]
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 20);

        this.products.set(sorted);
        // this.products.set(res.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20));
        console.log(res);

        this.loaderService.hide();
      },

      error: (err) => {
        console.log(err);
        this.loaderService.hide();
      },
    });

    this.destroyRef.onDestroy(() => {
      productSub.unsubscribe();
    });
  }

  viewDetails(id: string) {
    this.router.navigate(['/products', id]);
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

  getRating() {
    return Rating;
  }

  getDiscountPrice(item: Product): number {
    return this.productService.getDiscountPrice(item);
  }
}
