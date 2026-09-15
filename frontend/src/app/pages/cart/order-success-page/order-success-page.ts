import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../services/auth-user.service';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { switchMap, take } from 'rxjs';

@Component({
  selector: 'app-order-success-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-success-page.html',
  styleUrl: './order-success-page.css',
})
export class OrderSuccessPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private destroyRef = inject(DestroyRef);

  order = signal<Order | null>(null);
  errorMsg = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const sub = this.authService
      .getFullUser()
      .pipe(
        take(1),
        switchMap((user) => {
          if (!user?.uid) {
            this.errorMsg.set(true);
            return [];
          }

          return this.orderService.getOrderById(id);
        }),
        // switchMap((user) => {
        //   if (!user?.uid) throw new Error('No user');
        //   return this.orderService.getOrderById(user.uid, id);
        // }),
      )
      .subscribe({
        next: (data) => {
          if (!data) return;
          this.order.set(data);
          // this.order = {
          //   ...data,
          //   createdAt: data.createdAt ?? null,
          // };
        },

        error: (err) => {
          console.error('Order fetch error:', err);
          this.errorMsg.set(true);
        },
      });

    // const userSub = this.authService.getFullUser().subscribe({
    //   next: (user: any) => {
    //     if (!user?.uid) return;

    //     const orderSub = this.orderService.getOrderById(user.uid, id).subscribe({
    //       next: (data) => {
    //         if (!data) return;

    //         this.order = {
    //           ...data,
    //           createdAt: data.createdAt ?? null,
    //         };
    //       },
    //       error: (err) => {
    //         console.error('Order fetch error:', err);
    //         this.errorMsg.set(true);
    //       },
    //     });

    //     this.destroyRef.onDestroy(() => {
    //       orderSub.unsubscribe();
    //     });
    //   },

    //   error: (err) => {
    //     console.error('User fetch error:', err);
    //     this.errorMsg.set(true);
    //   },
    // });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
