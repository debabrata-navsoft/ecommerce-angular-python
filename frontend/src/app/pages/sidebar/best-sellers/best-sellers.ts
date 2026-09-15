import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { CategoryLabelPipe } from '../../../pipes/category-label.pipe';
import { Highlight } from '../../../directives/highlight';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth-user.service';
import { WishlistService } from '../../../services/wishlist.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { Rating } from '../../../utils/rating.util';
import { LoaderService } from '../../../services/loader.service';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-best-sellers',
  standalone: true,
  imports: [CommonModule, MatIconModule, TruncatePipe, CategoryLabelPipe, Highlight, Loader],
  templateUrl: './best-sellers.html',
  styleUrl: './best-sellers.css',
})
export class BestSellers implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
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

    const productSub = this.productService.getBestSellers().subscribe({
      next: (res) => {
        this.products.set(res);
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
