import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, take } from 'rxjs';

import { UserService } from '../../../services/user.service';
import { OrderService } from '../../../services/order.service';
import { User } from '../../../models/user.model';
import { Order } from '../../../models/order.model';
import { LoaderService } from '../../../services/loader.service';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-user-detail',
  imports: [CommonModule, RouterLink, Loader],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.css',
})
export class UserDetail implements OnInit {
  private userService = inject(UserService);
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private loaderService = inject(LoaderService);

  isLoading = this.loaderService.isLoading;

  user = signal<User | null>(null);
  orders = signal<Order[]>([]);
  errorMsg = signal(false);
  activeSection: string = 'profile';

  ngOnInit() {
    const uid = this.route.snapshot.paramMap.get('id');
    if (!uid) return;

    this.loaderService.show();

    const userSub = this.userService.getUserById(uid).subscribe({
      next: (user) => {
        this.user.set(user);
        this.loaderService.hide();
      },
      error: (err) => {
        console.error('User fetch error:', err);
        this.errorMsg.set(true);
        this.loaderService.hide();
      },
    });

    const orderSub = this.orderService.getOrdersForUser(uid).subscribe({
      next: (orders) => {
        this.orders.set(orders);
      },
      error: (err) => {
        console.error('Orders fetch error:', err);
      },
    });

    this.destroyRef.onDestroy(() => {
      userSub.unsubscribe();
      orderSub.unsubscribe();
    });
  }

  // ngOnInit() {
  //   const uid = this.route.snapshot.paramMap.get('id');
  //   if (!uid) return;

  //   this.loaderService.show();

  //   const sub = forkJoin({
  //     user: this.userService.getUserById(uid).pipe(take(1)),
  //     orders: this.orderService.getUserOrders(uid).pipe(take(1)),
  //     // user: this.userService.getUserById(uid),
  //     // orders: this.orderService.getUserOrders(uid),
  //   }).subscribe({
  //     next: ({ user, orders }) => {
  //       this.user.set(user);
  //       this.orders.set(orders);
  //       this.loaderService.hide();
  //     },
  //     error: (err) => {
  //       console.error('Fetch error:', err);
  //       this.errorMsg.set(true);
  //       this.loaderService.hide();
  //     },
  //   });

  // const userSub = this.userService.getUserById(uid).subscribe({
  //   next: (userData) => {
  //     this.user.set(userData);
  //     this.loaderService.hide();
  //   },

  //   error: (err) => {
  //     console.log('User fetch error: ', err);
  //     this.errorMsg = true;
  //     this.loaderService.hide();
  //   },
  // });

  // const orderSub = this.orderService.getUserOrders(uid).subscribe({
  //   next: (res) => {
  //     this.orders.set(res);
  //     this.loaderService.hide();
  //   },

  //   error: (err) => {
  //     console.log('Orders fetch error: ', err);
  //     this.errorMsg = true;
  //     this.loaderService.hide();
  //   },
  // });

  //   this.destroyRef.onDestroy(() => {
  //     sub.unsubscribe();
  //   });
  // }
}
