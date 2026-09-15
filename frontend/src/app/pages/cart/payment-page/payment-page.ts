import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Loader } from '../../../components/loader/loader';
import { PaymentMethod } from '../../../models/payment.model';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { CartService } from '../../../services/cart.service';
import { LoaderService } from '../../../services/loader.service';
import { OrderService, PlaceOrderResult } from '../../../services/order.service';
import { RazorpayService, RazorpaySuccess } from '../../../services/razorpay.service';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-payment-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TruncatePipe, Loader],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.css',
})
export class PaymentPage {
  private router = inject(Router);
  private orderService = inject(OrderService);
  private loaderService = inject(LoaderService);
  private snackbar = inject(SnackbarService);
  private cartService = inject(CartService);
  private razorpayService = inject(RazorpayService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;
  selectedMethod = signal<PaymentMethod>('cod');
  orderData = signal<any>(null);

  private paying = signal(false);

  form = {
    upiId: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  };

  constructor() {
    const nav = this.router.currentNavigation();
    const state = nav?.extras?.state as { orderData: any };

    if (state?.orderData) {
      this.orderData.set(state.orderData);
    } else {
      this.snackbar.error('Session expired. Please try again.');
      this.router.navigate(['/']);
    }
  }

  select(method: PaymentMethod) {
    this.selectedMethod.set(method);
  }

  /**
   * Order first, then pay.
   *
   * The previous flow paid first and created the order afterwards from data the browser
   * had assembled — so the totals and the "paid" status were whatever the client claimed.
   * Now the API builds the order from the server's own view of the cart, hands back a
   * Razorpay order id, and only marks it paid once it has verified the signature.
   */
  payNow() {
    const data = this.orderData();
    if (!data) {
      this.snackbar.error('Order data missing!');
      return;
    }
    if (this.paying()) return;

    this.paying.set(true);
    this.loaderService.show();

    const sub = this.orderService
      .placeOrder({
        address: data.address,
        shippingMethod: data.shippingMethod === 'express' ? 'express' : 'free',
        paymentMethod: this.selectedMethod(),
      })
      .subscribe({
        next: (result) => {
          if (this.selectedMethod() === 'cod') {
            this.finish(result.order.orderId!);
            return;
          }
          this.openCheckout(result, data);
        },
        error: (err: Error) => {
          this.stop();
          this.snackbar.error(err.message || 'Could not place the order. Please try again.');
        },
      });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private openCheckout(result: PlaceOrderResult, data: any) {
    const orderId = result.order.orderId!;

    if (!result.razorpay) {
      this.stop();
      this.snackbar.error(
        'Online payment is unavailable right now. Please choose Cash on Delivery.',
      );
      this.orderService.abandonPayment(orderId, 'failed').subscribe({ error: () => undefined });
      return;
    }

    this.loaderService.hide();

    this.razorpayService
      .openPayment(
        result.razorpay,
        this.selectedMethod(),
        {
          name: data.address?.fullName || '',
          email: data.userEmail || '',
          contact: data.address?.phone || '',
        },
        (payment: RazorpaySuccess) => this.verify(orderId, payment),
        () => this.release(orderId, 'cancelled', 'Payment cancelled.'),
        (error: any) =>
          this.release(orderId, 'failed', 'Payment failed: ' + (error?.description ?? '')),
      )
      .catch((err: Error) => {
        this.release(orderId, 'failed', err.message || 'Could not open the payment window.');
      });
  }

  private verify(orderId: string, payment: RazorpaySuccess) {
    this.loaderService.show();

    this.orderService.verifyPayment(orderId, payment).subscribe({
      next: () => this.finish(orderId),
      error: (err: Error) => {
        this.stop();
        // The order stays on record as failed; the API already released the stock.
        this.snackbar.error(err.message || 'We could not verify the payment. Contact support.');
      },
    });
  }

  /** Rolls the order back so the reserved stock is returned. */
  private release(orderId: string, reason: 'cancelled' | 'failed', message: string) {
    this.stop();
    this.snackbar.error(message);
    this.orderService.abandonPayment(orderId, reason).subscribe({ error: () => undefined });
  }

  private finish(orderId: string) {
    this.stop();
    // The API clears the cart as part of placing the order; mirror it locally.
    this.cartService.cart.set([]);
    this.snackbar.success('Order placed successfully!');
    this.router.navigate(['/cart/order-success', orderId]);
  }

  private stop() {
    this.paying.set(false);
    this.loaderService.hide();
  }
}
