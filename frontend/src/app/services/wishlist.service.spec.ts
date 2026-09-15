import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { environment } from '../../environments/environment';
import { SessionService } from '../core/session.service';
import { Product } from '../models/product.model';
import { WishlistService } from './wishlist.service';

const USER = {
  uid: 'u1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneNumber: [],
  role: 'user' as const,
};

function product(id: string): Product {
  return {
    id,
    title: `Product ${id}`,
    price: 100,
    stock: 5,
    brand: 'Acme',
    color: 'Red',
    category: 'electronics',
    subCategory: 'mobiles',
    image: 'img.png',
    description: '',
  };
}

describe('WishlistService', () => {
  let http: HttpTestingController;
  let service: WishlistService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SessionService,
          useValue: {
            user$: of(USER),
            user: () => USER,
            isReady: () => true,
            uid: USER.uid,
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WishlistService);

    // The constructor subscribes to the session and loads the list.
    http.expectOne(`${environment.apiUrl}/wishlist`).flush({ items: [] });
  });

  afterEach(() => http.verify());

  /**
   * Regression: every call site does `wishlistService.addToWishlist(p)` without
   * subscribing, because the Firestore version it replaced was eager. A cold HttpClient
   * observable sends nothing in that case, so the item showed up via the optimistic
   * signal update and then vanished on the next load.
   */
  it('sends the POST even though the caller never subscribes', () => {
    service.addToWishlist(product('p1'));

    const req = http.expectOne(`${environment.apiUrl}/wishlist`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ productId: 'p1' });

    req.flush({ items: [product('p1')] });

    expect(service.getWishlistSignal().length).toBe(1);
    expect(service.isInWishlist('p1')).toBeTrue();
  });

  it('reconciles the list against the server response', () => {
    service.addToWishlist(product('p1'));

    // Optimistic update lands before the response.
    expect(service.itemCount()).toBe(1);

    http
      .expectOne(`${environment.apiUrl}/wishlist`)
      .flush({ items: [product('p1'), product('p2')] });

    expect(service.itemCount()).toBe(2);
  });

  it('rolls the signal back when the request fails', () => {
    service.addToWishlist(product('p1'));
    expect(service.itemCount()).toBe(1);

    http
      .expectOne(`${environment.apiUrl}/wishlist`)
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

    expect(service.itemCount()).toBe(0);
  });

  it('does not re-post a product already in the list', () => {
    service.addToWishlist(product('p1'));
    http.expectOne(`${environment.apiUrl}/wishlist`).flush({ items: [product('p1')] });

    service.addToWishlist(product('p1'));

    // expectNone is not a Jasmine expectation, so assert the queue explicitly.
    expect(http.match(`${environment.apiUrl}/wishlist`).length).toBe(0);
    expect(service.itemCount()).toBe(1);
  });

  it('removes optimistically and keeps the server list', () => {
    service.addToWishlist(product('p1'));
    http.expectOne(`${environment.apiUrl}/wishlist`).flush({ items: [product('p1')] });

    service.removeFromWishlist('p1');

    const req = http.expectOne(`${environment.apiUrl}/wishlist/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ items: [] });

    expect(service.itemCount()).toBe(0);
  });
});
