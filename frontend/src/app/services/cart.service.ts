import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { ApiService, fireAndShare } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';

/**
 * Same shape as before: signals in a root service, mutated optimistically so the UI does
 * not wait on the round-trip. The difference is that every mutation endpoint returns the
 * authoritative list, so the optimistic value is reconciled against the server instead of
 * being assumed correct — and a failed write rolls back rather than leaving the UI lying.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private destroyRef = inject(DestroyRef);

  cartLoaded = signal(false);
  cart = signal<CartItem[]>([]);
  itemCount = computed(() => this.cart().length);

  /** Kept for templates that still read it; SaveLaterService owns the real list. */
  savedLater = signal<CartItem[]>([]);

  totalPrice = computed(() =>
    this.cart().reduce((acc, item) => acc + this.getDiscountPrice(item) * item.quantity, 0),
  );

  constructor() {
    const sub = this.session.user$.subscribe((user) => {
      if (user) {
        this.loadCart();
      } else {
        this.cart.set([]);
        this.cartLoaded.set(false);
      }
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /** Runs during SSR too — the server render carries the visitor's cookie. */
  loadCart(): void {
    this.api.get<{ items: CartItem[] }>('/cart').subscribe({
      next: (res) => {
        this.cart.set(res.items);
        this.cartLoaded.set(true);
      },
      error: () => this.cartLoaded.set(true),
    });
  }

  getDiscountPrice(item: CartItem): number {
    if (!item.discount) return item.price;
    return item.price - (item.price * item.discount) / 100;
  }

  /** Applies `next` immediately, then replaces it with whatever the server reports. */
  private commit(
    request: Observable<{ items: CartItem[] }>,
    next: CartItem[],
  ): Observable<{ items: CartItem[] }> {
    const rollback = this.cart();
    this.cart.set(next);

    return request.pipe(
      tap({
        next: (res) => this.cart.set(res.items),
        error: () => this.cart.set(rollback),
      }),
    );
  }

  addToCart(product: Product): void {
    if (!this.session.uid) return;

    const existing = this.cart().find((i) => i.id === product.id);

    const next = existing
      ? this.cart().map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      : [
          {
            id: product.id,
            name: product.title,
            price: product.price,
            discount: product.discount || 0,
            image: product.image,
            category: product.category,
            subCategory: product.subCategory,
            brand: product.brand,
            stock: product.stock,
            quantity: 1,
            createdAt: Date.now(),
          } as CartItem,
          ...this.cart(),
        ];

    this.commit(
      this.api.post<{ items: CartItem[] }>('/cart', { productId: product.id }),
      next,
    ).subscribe({ error: () => undefined });
  }

  removeItem(id: string): void {
    if (!this.session.uid) return;

    this.commit(
      this.api.delete<{ items: CartItem[] }>(`/cart/${id}`),
      this.cart().filter((i) => i.id !== id),
    ).subscribe({ error: () => undefined });
  }

  updateQuantity(id: string, qty: number): void {
    if (!this.session.uid) return;

    if (qty <= 0) {
      this.removeItem(id);
      return;
    }

    this.commit(
      this.api.patch<{ items: CartItem[] }>(`/cart/${id}`, { quantity: qty }),
      this.cart().map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
    ).subscribe({ error: () => undefined });
  }

  clearCart(): void {
    if (!this.session.uid) return;

    this.commit(this.api.delete<{ items: CartItem[] }>('/cart'), []).subscribe({
      error: () => undefined,
    });
  }

  addCartItemToCart(item: CartItem): void {
    if (!this.session.uid) return;

    const existing = this.cart().find((i) => i.id === item.id);

    this.commit(
      this.api.post<{ items: CartItem[] }>('/cart', { productId: item.id }),
      existing
        ? this.cart().map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [{ ...item, quantity: 1, createdAt: Date.now() }, ...this.cart()],
    ).subscribe({ error: () => undefined });
  }

  /**
   * Moves the item to saved-later in one request. Previously this only removed from the
   * cart and every caller had to remember to also call SaveLaterService.saveForLater() —
   * forget one and the item vanished.
   */
  saveForLater(item: CartItem): Observable<{ items: CartItem[]; savedLater: CartItem[] }> {
    if (!this.session.uid) return of({ items: this.cart(), savedLater: this.savedLater() });

    const rollback = this.cart();
    this.cart.set(this.cart().filter((i) => i.id !== item.id));

    return fireAndShare(
      this.api
        .post<{ items: CartItem[]; savedLater: CartItem[] }>(`/cart/${item.id}/save-for-later`)
        .pipe(
          tap({
            next: (res) => {
              this.cart.set(res.items);
              this.savedLater.set(res.savedLater);
            },
            error: () => this.cart.set(rollback),
          }),
        ),
    );
  }
}
