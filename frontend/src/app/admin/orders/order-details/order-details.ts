import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { OrderService } from '../../../services/order.service';
import { LoaderService } from '../../../services/loader.service';
import { Order, OrderItem } from '../../../models/order.model';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, Loader],
  templateUrl: './order-details.html',
  styleUrl: './order-details.css',
})
export class OrderDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private loaderService = inject(LoaderService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;

  order = signal<Order | null>(null);

  ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('id');
    const userId = this.route.snapshot.queryParamMap.get('userId');

    if (!orderId || !userId) return;

    this.loaderService.show();

    const sub = this.orderService.getOrderById(orderId).subscribe({
      next: (res) => {
        console.log('ORDER DATA', res);
        this.order.set(res);
        this.loaderService.hide();
      },
      error: () => this.loaderService.hide(),
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  getDiscountPrice(item: OrderItem): number {
    return this.orderService.getDiscountPrice(item);
  }

  // ngOnInit() {
  //   const orderId = this.route.snapshot.paramMap.get('id');

  //   if (!orderId) return;

  //   this.loader.show();

  //   const sub = this.orderService.getOrderByIdAdmin(orderId).subscribe({
  //     next: (res) => {
  //       this.order.set(res);
  //       this.loader.hide();
  //     },
  //     error: () => this.loader.hide(),
  //   });

  //   this.destroyRef.onDestroy(() => sub.unsubscribe());
  // }
}
