import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, switchMap } from 'rxjs';

import { AuthService } from '../../../services/auth-user.service';
import { OrderService } from '../../../services/order.service';
import { ProfileDetails } from '../profile-details/profile-details';
import { Address } from '../address/address';
import { OrderHistory } from '../order-history/order-history';
import { User } from '../../../models/user.model';
import { Order } from '../../../models/order.model';
import { SnackbarService } from '../../../services/snackbar.service';
import { LoaderService } from '../../../services/loader.service';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ProfileDetails, Address, OrderHistory, Loader],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage implements OnInit {
  private authService = inject(AuthService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(SnackbarService);
  private loaderService = inject(LoaderService);

  isLoading = this.loaderService.isLoading;

  orders = signal<Order[]>([]);
  user = signal<User | null>(null);
  activeSection = 'orders';

  ngOnInit() {
    this.loaderService.show();

    const userSub = this.authService
      .getFullUser()
      .pipe(
        switchMap((user) => {
          this.user.set(user);
          if (!user?.uid) {
            this.orders.set([]);
            return EMPTY;
          }
          return this.orderService.getUserOrders();
        }),
      )
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.loaderService.hide();
        },

        error: (err) => {
          console.error('Fetch error:', err);
          this.loaderService.hide();
        },
      });

    // const userSub = this.authService.getFullUser().subscribe({
    //   next: (user) => {
    //     this.user.set(user);

    //     if (!user?.uid) {
    //       this.loaderService.hide();
    //       return;
    //     }

    //     const orderSub = this.orderService.getUserOrders(user.uid).subscribe({
    //       next: (orders) => {
    //         this.orders.set(
    //           orders.map((o: Order) => ({
    //             ...o,
    //             // date: o.date?.toDate ? o.date.toDate() : o.date,
    //           })),
    //         );
    //         this.loaderService.hide();
    //       },
    //       error: (err) => {
    //         console.error('Orders error:', err);
    //         this.loaderService.hide();
    //       },
    //     });

    //     this.destroyRef.onDestroy(() => {
    //       orderSub.unsubscribe();
    //     });
    //   },

    //   error: (err) => {
    //     console.error('User error:', err);
    //     this.loaderService.hide();
    //   },
    // });

    this.destroyRef.onDestroy(() => {
      userSub.unsubscribe();
    });
  }

  changeSection(section: string) {
    this.activeSection = section;
  }

  logout() {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/login']);
      this.snackBar.success('Logged out successfully');
    });
  }

  // logout() {
  //   this.authService.logout();
  //   this.router.navigate(['/login']);
  // }
}
