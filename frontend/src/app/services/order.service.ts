import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiService } from '../core/api.service';
import { Order, OrderAddress, OrderItem } from '../models/order.model';
import { PaymentMethod } from '../models/payment.model';

export interface PlaceOrderRequest {
  address: OrderAddress;
  shippingMethod: 'free' | 'express';
  paymentMethod: PaymentMethod;
}

/** What the client needs to open the Razorpay checkout, minted by the API. */
export interface RazorpayHandoff {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface PlaceOrderResult {
  order: Order;
  razorpay: RazorpayHandoff | null;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private api = inject(ApiService);

  getDiscountPrice(item: OrderItem): number {
    const discount = item.discount ?? 0;
    return item.price - (item.price * discount) / 100;
  }

  /**
   * Items, prices and totals are no longer sent from the browser — the API reads the
   * user's cart and recomputes them. That closes the hole where a crafted request could
   * set its own `total`, and it removes the Firestore double-write: one `orders`
   * collection now serves both the customer's history and the admin list.
   */
  placeOrder(request: PlaceOrderRequest): Observable<PlaceOrderResult> {
    return this.api.post<PlaceOrderResult>('/orders', request);
  }

  /** The signed-in customer's own orders. */
  getUserOrders(): Observable<Order[]> {
    return this.api.get<{ items: Order[] }>('/orders').pipe(map((res) => res.items));
  }

  /** Admin-only: one customer's orders, filtered out of the global collection. */
  getOrdersForUser(userId: string): Observable<Order[]> {
    return this.api
      .get<{ items: Order[] }>('/orders/all', { userId })
      .pipe(map((res) => res.items));
  }

  getOrderById(orderId: string): Observable<Order | null> {
    return this.api.get<{ order: Order }>(`/orders/${orderId}`).pipe(map((res) => res.order));
  }

  getAllOrders(): Observable<Order[]> {
    return this.api.get<{ items: Order[] }>('/orders/all').pipe(map((res) => res.items));
  }

  updateOrderStatus(orderId: string, status: Order['status']): Observable<Order> {
    return this.api
      .patch<{ order: Order }>(`/orders/${orderId}/status`, { status })
      .pipe(map((res) => res.order));
  }

  cancelOrder(orderId: string): Observable<Order> {
    return this.api.post<{ order: Order }>(`/orders/${orderId}/cancel`).pipe(map((r) => r.order));
  }

  /** Confirms a Razorpay payment. The API verifies the signature before marking it paid. */
  verifyPayment(
    orderId: string,
    payload: { razorpayPaymentId: string; razorpayOrderId: string; signature: string },
  ): Observable<Order> {
    return this.api
      .post<{ order: Order }>(`/payments/${orderId}/verify`, payload)
      .pipe(map((res) => res.order));
  }

  /** Releases the reserved stock when the user dismisses or fails the payment. */
  abandonPayment(orderId: string, reason: 'cancelled' | 'failed'): Observable<Order> {
    return this.api
      .post<{ order: Order }>(`/payments/${orderId}/abandon`, { reason })
      .pipe(map((res) => res.order));
  }
}
