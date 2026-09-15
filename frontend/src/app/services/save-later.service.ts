import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { ApiService, fireAndShare } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { CartItem } from '../models/cart.model';
import { CartService } from './cart.service';

@Injectable({ providedIn: 'root' })
export class SaveLaterService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private cartService = inject(CartService);
  private destroyRef = inject(DestroyRef);

  savedLater = signal<CartItem[]>([]);
  itemCount = computed(() => this.savedLater().length);

  constructor() {
    const sub = this.session.user$.subscribe((user) => {
      if (user) {
        this.loadSavedLater();
      } else {
        this.savedLater.set([]);
      }
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /** Runs during SSR too — the server render carries the visitor's cookie. */
  loadSavedLater(): void {
    this.api.get<{ items: CartItem[] }>('/saved-later').subscribe({
      next: (res) => this.savedLater.set(res.items),
      error: () => undefined,
    });
  }

  /**
   * Delegates to the atomic cart endpoint so both lists move together. Returns void
   * rather than the request: HttpClient observables are cold, so handing one back after
   * subscribing here would fire a second request if the caller subscribed too.
   */
  saveForLater(item: CartItem): void {
    this.cartService.saveForLater(item).subscribe({
      next: (res) => this.savedLater.set(res.savedLater),
      error: () => undefined,
    });
  }

  moveToCart(item: CartItem): void {
    if (!this.session.uid) return;

    const rollback = this.savedLater();
    this.savedLater.set(rollback.filter((i) => i.id !== item.id));

    this.api
      .post<{ items: CartItem[]; cart: CartItem[] }>(`/saved-later/${item.id}/move-to-cart`)
      .subscribe({
        next: (res) => {
          this.savedLater.set(res.items);
          this.cartService.cart.set(res.cart);
        },
        error: () => this.savedLater.set(rollback),
      });
  }

  removeFromSaved(id: string): void {
    if (!this.session.uid) return;

    const rollback = this.savedLater();
    this.savedLater.set(rollback.filter((i) => i.id !== id));

    this.api.delete<{ items: CartItem[] }>(`/saved-later/${id}`).subscribe({
      next: (res) => this.savedLater.set(res.items),
      error: () => this.savedLater.set(rollback),
    });
  }

  addToSaved(productId: string): Observable<{ items: CartItem[] }> {
    if (!this.session.uid) return of({ items: this.savedLater() });

    return fireAndShare(
      this.api
        .post<{ items: CartItem[] }>('/saved-later', { productId })
        .pipe(tap((res) => this.savedLater.set(res.items))),
    );
  }
}
