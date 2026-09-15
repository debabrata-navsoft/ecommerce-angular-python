import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CartService } from '../../../../services/cart.service';
import { AuthService } from '../../../../services/auth-user.service';
import { TruncatePipe } from '../../../../pipes/truncate.pipe';
import { OrderService } from '../../../../services/order.service';
import { LoaderService } from '../../../../services/loader.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { CartItem } from '../../../../models/cart.model';
import { CheckoutAddress } from '../checkout-address/checkout-address';
import { Order, OrderAddress } from '../../../../models/order.model';
import { User } from '../../../../models/user.model';
import { Loader } from '../../../../components/loader/loader';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, TruncatePipe, CheckoutAddress, Loader],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.css',
})
export class CheckoutPage implements OnInit {
  public cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private destroyRef = inject(DestroyRef);
  private loaderService = inject(LoaderService);
  private snackbar = inject(SnackbarService);

  isLoading = this.loaderService.isLoading;

  user = signal<User | null>(null);
  selectedAddress = signal<OrderAddress | null>(null);
  orderPlaced = signal(false);

  checkoutForm = signal({
    shippingMethod: 'free',
  });

  constructor() {
    effect(() => {
      if (
        this.cartService.cartLoaded() &&
        this.cartService.cart().length === 0 &&
        !this.orderPlaced()
      ) {
        const currentUrl = this.router.url;

        if (!currentUrl.includes('payment')) {
          this.router.navigate(['/']);
        }
        // this.router.navigate(['/']);
      }
    });
  }

  ngOnInit(): void {
    // if (this.cartService.cart().length === 0) {
    //   this.router.navigate(['/']);
    //   return;
    // }

    this.loaderService.show();

    const sub = this.authService.getFullUser().subscribe({
      next: (user: any) => {
        // if (user) {
        this.user.set(user);
        this.loaderService.hide();
        // this.checkoutForm.update((form) => ({
        //   ...form,
        //   fullName: user.firstName + ' ' + user.lastName,
        //   email: user.email,
        //   phone: user.phoneNumber?.[0] || '',
        // }));
        // }
      },

      error: (err) => {
        this.loaderService.hide();
        console.error('User fetch error:', err);
      },
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  onAddressSelect(addr: any) {
    this.selectedAddress.set(addr);
  }

  setShippingMethod(method: 'free' | 'express') {
    this.checkoutForm.update((f) => ({
      ...f,
      shippingMethod: method,
    }));
  }

  getDiscountPrice(item: CartItem): number {
    return this.cartService.getDiscountPrice(item);
  }

  shippingPrice = computed(() => (this.checkoutForm().shippingMethod === 'express' ? 90 : 0));

  subTotal = computed(() => {
    return this.cartService.totalPrice();
  });

  gst = computed(() => this.subTotal() * 0.18);

  totalPrice = computed(() => this.subTotal() + this.gst() + this.shippingPrice());

  submitOrder() {
    const address = this.selectedAddress();
    const user = this.user();

    if (!address) {
      this.snackbar.error('Please select an address!');
      return;
    }

    if (!user?.uid) {
      this.snackbar.error('User not found!');
      return;
    }

    const orderData = {
      userId: user.uid,
      userEmail: user.email,
      address,
      shippingMethod: this.checkoutForm().shippingMethod,
      items: this.cartService.cart().map((item) => ({
        productId: item.id,
        title: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount || 0,
      })),
      subTotal: this.subTotal(),
      gst: this.gst(),
      total: this.totalPrice(),
      createdAt: Date.now(),
    };

    this.orderPlaced.set(true);

    this.router.navigate(['/cart/payment'], {
      state: { orderData },
    });
  }

  // submitOrder() {
  //   const address = this.selectedAddress();
  //   const user = this.user();
  //   if (!address) {
  //     this.snackbar.error('Please Select addresss!');
  //     return;
  //   }

  //   if (!user?.uid) {
  //     this.snackbar.error('User not found!');
  //     return;
  //   }

  //   this.loaderService.show();

  //   const uid = user.uid as string;

  //   const order: Omit<Order, 'id' | 'status'> = {
  //     userId: uid,
  //     userEmail: user.email,
  //     // userId: user.uid,
  //     address,
  //     shippingMethod: this.checkoutForm().shippingMethod,
  //     items: this.cartService.cart().map((item) => ({
  //       productId: item.id,
  //       title: item.name,
  //       image: item.image,
  //       price: item.price,
  //       quantity: item.quantity,
  //       discount: item.discount || 0,
  //     })),
  //     subTotal: this.subTotal(),
  //     gst: this.gst(),
  //     total: this.totalPrice(),
  //     // status: 'pending',
  //     createdAt: Date.now(),
  //   };

  //   const orderSub = this.orderService.createOrder(uid, order as Order).subscribe({
  //     next: (res) => {
  //       this.loaderService.hide();
  //       this.orderPlaced.set(true);
  //       this.cartService.clearCart();
  //       this.snackbar.success('Order placed!');
  //       this.router.navigate(['cart/order-success', res.orderId]);
  //     },

  //     error: (err) => {
  //       this.loaderService.hide();
  //       this.snackbar.error('Order failed!');
  //       console.log(err);
  //     },
  //   });

  //   this.destroyRef.onDestroy(() => {
  //     orderSub.unsubscribe();
  //   });
  // }
}
