import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  Input,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { Navbar } from '../navbar/navbar';
import { Breadcrumb } from '../breadcrumb/breadcrumb';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth-user.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    CommonModule,
    FormsModule,
    Navbar,
    MatIconModule,
    MatSnackBarModule,
    Breadcrumb,
  ],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  private wishlistService = inject(WishlistService);
  private el = inject(ElementRef);
  private snackBar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  private onOnline = () => {
    this.isOnline.set(true);
  };
  private onOffline = () => {
    this.isOnline.set(false);
  };

  hideBreadcrumb = input(false);
  // @Input() hideBreadcrumb = false;  // old version

  suggestions = signal<Product[]>([]);
  allProducts = signal<Product[]>([]);
  openDropdownIndex = signal<number | null>(null);

  searchTerm = '';
  activeIndex = signal(0);
  isOnline = signal(true);
  showMenu = signal(false);
  showDropdown = signal(false);

  itemCount = this.cartService.itemCount;
  wishlistCount = this.wishlistService.itemCount;

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: Event) {
    const clickedInside = this.el.nativeElement.contains(event.target);

    if (!clickedInside) {
      this.showDropdown.set(false);
    }

    // if (!clickedInside) {
    //   this.suggestions = [];
    //   this.activeIndex = 0;
    // }
  }

  get authReady() {
    return this.authService.isAuthReady();
  }

  get isLoggedIn() {
    return this.authService.isLoggedIn() && this.isOnline();
  }

  // get isLoggedIn() {
  //   return this.authService.isLoggedIn();
  // }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showMenu.set(!this.showMenu());
  }

  closeMenu() {
    this.showMenu.set(false);
  }

  logout() {
    this.authService.logout();
    this.showMenu.set(false);
    this.snackBar.success('Logged out successfully');
    this.router.navigate(['/']);
  }

  viewProfile() {
    this.showMenu.set(false);
    this.router.navigate(['/account']);
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // ← MOVE THIS GUARD UP
      this.isOnline.set(navigator.onLine);

      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);

      const sub = this.productService.getProducts().subscribe((products) => {
        this.allProducts.set(products);
      });

      this.destroyRef.onDestroy(() => {
        sub.unsubscribe();
        window.removeEventListener('online', this.onOnline);
        window.removeEventListener('offline', this.onOffline);
      });
    }
  }

  onInputChange() {
    this.activeIndex.set(0);
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      this.suggestions.set([]);
      this.showDropdown.set(false);
      return;
    }

    this.showDropdown.set(true);
    this.suggestions.set(
      this.allProducts()
        .filter((p) => {
          return p.searchName?.toLowerCase().includes(term) || p.title.toLowerCase().includes(term);
        })
        .slice(0, 5),
    );
    // this.suggestions = this.allProducts
    //   .filter((p) => p.title.toLowerCase().includes(term))
    //   .slice(0, 5);
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.suggestions().length) return;

    if (event.key === 'ArrowDown') {
      this.activeIndex.set((this.activeIndex() + 1) % this.suggestions().length);
    }

    if (event.key === 'ArrowUp') {
      this.activeIndex.set(
        this.activeIndex() <= 0 ? this.suggestions().length - 1 : this.activeIndex() - 1,
      );
    }

    if (event.key === 'Enter') {
      const product = this.suggestions()[this.activeIndex()];
      if (product) {
        this.selectProduct(product);
      } else {
        this.searchProduct();
      }
    }
  }

  selectProduct(product: Product) {
    this.searchTerm = '';
    this.suggestions.set([]);
    this.showDropdown.set(false);
    this.router.navigate(['/products', product.id]);
  }

  searchProduct() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return;

    const match = this.allProducts().find((p) => {
      return p.searchName?.toLowerCase().includes(term) || p.title.toLowerCase().includes(term);
    });

    // const match = this.allProducts.find((p) => p.title.toLowerCase().includes(term));

    if (match) {
      this.searchTerm = '';
      this.suggestions.set([]);
      this.showDropdown.set(false);
      this.router.navigate(['/products', match.id]);
    } else {
      this.snackBar.error('Product not found');
    }
  }
}
