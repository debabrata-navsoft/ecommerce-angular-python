import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIcon } from '@angular/material/icon';

import { OrderService } from '../../../services/order.service';
import { LoaderService } from '../../../services/loader.service';
import { Order } from '../../../models/order.model';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIcon, MatPaginatorModule, Loader],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
})
export class OrderList implements OnInit {
  private orderService = inject(OrderService);
  private loaderService = inject(LoaderService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;

  sortDirection = signal<'asc' | 'desc'>('desc');
  // sortDirection = signal<'asc' | 'desc'>('asc');
  orders = signal<Order[]>([]);
  pageIndex = signal(0);
  pageSize = signal(10);

  ngOnInit() {
    this.loaderService.show();

    const orderSub = this.orderService.getAllOrders().subscribe({
      next: (res) => {
        this.orders.set(res || []);
        // const sorted = (res || []).sort((a: any, b: any) => b.createdAt - a.createdAt);
        // this.orders.set(sorted);
        this.loaderService.hide();
      },

      error: (err) => {
        console.log(err);
        this.loaderService.hide();
      },
    });

    this.destroyRef.onDestroy(() => {
      orderSub.unsubscribe();
    });

    // this.orderService.getAllOrders().subscribe((res) => {
    //   const sorted = (res || []).sort((a: any, b: any) => b.createdAt - a.createdAt);

    //   this.orders.set(sorted);
    //   // this.orders.set(res || []);
    // });
  }

  changeStatus(order: Order, event: Event) {
    const status = (event.target as HTMLSelectElement).value as Order['status'];

    const statusSub = this.orderService
      // One `orders` collection now, so the status is written once instead of to both
      // the user subcollection and the global mirror.
      .updateOrderStatus(order.orderId!, status)
      .subscribe({
        next: () => {
          const updated = this.orders().map((o) =>
            o.orderId === order.orderId ? { ...o, status } : o,
          );
          this.orders.set(updated);
        },
        error: (err) => console.log(err),
      });

    this.destroyRef.onDestroy(() => {
      statusSub.unsubscribe();
    });
  }

  sortedOrders = computed(() => {
    const dir = this.sortDirection();

    return [...this.orders()].sort((a, b) => {
      const aVal = a.createdAt ?? 0;
      const bVal = b.createdAt ?? 0;
      return dir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // return [...this.orders()].sort((a: any, b: any) => {
    //   const aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    //   const bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    //   return dir === 'asc' ? aVal - bVal : bVal - aVal;
    // });
  });

  totalItems = computed(() => this.orders().length);

  paginatedOrders = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();

    return this.sortedOrders().slice(start, end);
  });

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  toggleSort() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    this.pageIndex.set(0);
  }
}
