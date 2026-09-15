import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';

import { ApiService, fireAndShare } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private destroyRef = inject(DestroyRef);

  private wishlist = signal<Product[]>([]);

  itemCount = computed(() => this.wishlist().length);
  getWishlistSignal = this.wishlist.asReadonly();

  constructor() {
    const sub = this.session.user$.subscribe((user) => {
      if (user) {
        this.loadWishlist();
      } else {
        this.wishlist.set([]);
      }
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /**
   * Runs during SSR too. ApiService forwards the visitor's cookie on the server, so the
   * list renders with the page instead of arriving empty and popping in after hydration.
   */
  loadWishlist(): void {
    this.api.get<{ items: Product[] }>('/wishlist').subscribe({
      next: (res) => this.wishlist.set(res.items),
      error: () => undefined,
    });
  }

  addToWishlist(product: Product): Observable<void> {
    if (!this.session.uid) return of(void 0);
    if (this.isInWishlist(product.id)) return of(void 0);

    const rollback = this.wishlist();
    this.wishlist.set([{ ...product, createdAt: Date.now() }, ...rollback]);

    // Every call site does `wishlistService.addToWishlist(product)` without subscribing,
    // so this must not be cold — otherwise the POST never fires and the item disappears
    // on the next load.
    return fireAndShare(
      this.api.post<{ items: Product[] }>('/wishlist', { productId: product.id }).pipe(
        tap({
          next: (res) => this.wishlist.set(res.items),
          error: () => this.wishlist.set(rollback),
        }),
        map(() => void 0),
      ),
    );
  }

  removeFromWishlist(id: string): void {
    if (!this.session.uid) return;

    const rollback = this.wishlist();
    this.wishlist.set(rollback.filter((p) => p.id !== id));

    this.api.delete<{ items: Product[] }>(`/wishlist/${id}`).subscribe({
      next: (res) => this.wishlist.set(res.items),
      error: (err) => {
        console.error('Delete failed:', err);
        this.wishlist.set(rollback);
      },
    });
  }

  isInWishlist(id: string | undefined): boolean {
    if (!id) return false;
    return this.wishlist().some((p) => p.id === id);
  }
}
