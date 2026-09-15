import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { environment } from '../../environments/environment';
import { PaymentMethod } from '../models/payment.model';
import { RazorpayHandoff } from './order.service';

export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

export interface RazorpaySuccess {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  signature: string;
}

/**
 * Opens the Razorpay checkout for an order the API already created.
 *
 * The important change from the previous version: the checkout is bound to a server-side
 * `order_id`, and the success callback hands back `razorpay_signature` so the API can
 * verify the payment with its secret. Before, the browser reported a bare payment id and
 * the app recorded the order as paid on that word alone.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayService {
  private platformId = inject(PLATFORM_ID);

  private loadRazorpay(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId)) {
        reject(new Error('Razorpay can only be opened in the browser'));
        return;
      }

      if ((window as any).Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the Razorpay checkout script'));
      document.body.appendChild(script);
    });
  }

  async openPayment(
    handoff: RazorpayHandoff,
    method: PaymentMethod,
    prefill: RazorpayPrefill,
    onSuccess: (result: RazorpaySuccess) => void,
    onCancel: () => void,
    onError: (error: any) => void,
  ): Promise<void> {
    await this.loadRazorpay();

    const options = {
      // Prefer the key the API minted the order with, so the two can never disagree.
      key: handoff.keyId || environment.razorpayKey,
      order_id: handoff.orderId,
      amount: handoff.amount,
      currency: handoff.currency || 'INR',
      name: 'Your Store Name',
      description: 'Order Payment',
      prefill,
      theme: { color: '#f76707' },
      method: this.getMethodKey(method),

      handler: (response: any) => {
        onSuccess({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },

      modal: {
        ondismiss: () => onCancel(),
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', (response: any) => onError(response.error));
    rzp.open();
  }

  private getMethodKey(method: string): string | undefined {
    const map: Record<string, string> = {
      upi: 'upi',
      card: 'card',
      emi: 'emi',
      netbanking: 'netbanking',
    };
    return map[method] ?? undefined;
  }
}
