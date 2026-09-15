import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIcon } from '@angular/material/icon';

import { UserService } from '../../services/user.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { LoaderService } from '../../services/loader.service';
import { User } from '../../models/user.model';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';
import { TruncatePipe } from '../../pipes/truncate.pipe';
import { AdminAuthService } from '../../services/auth-admin.service';
import { Loader } from '../../components/loader/loader';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIcon,
    TruncatePipe,
    DatePipe,
    DecimalPipe,
    SlicePipe,
    Loader,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private adminAuthService = inject(AdminAuthService);
  private userService = inject(UserService);
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private loaderService = inject(LoaderService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;

  today = new Date();
  adminName = 'Admin';

  users = signal<User[]>([]);
  products = signal<Product[]>([]);
  orders = signal<Order[]>([]);

  totalUsers = computed(() => this.users().length);
  totalProducts = computed(() => this.products().length);
  totalOrders = computed(() => this.orders().length);

  pendingOrders = computed(() => this.orders().filter((o) => o.status === 'pending').length);

  cancelledOrders = computed(() => this.orders().filter((o) => o.status === 'cancelled').length);

  recentOrders = computed(() =>
    [...this.orders()]
      .sort((a: any, b: any) => {
        const aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bVal - aVal;
      })
      .slice(0, 4),
  );

  recentUsers = computed(() =>
    [...this.users()]
      .sort((a: any, b: any) => {
        const aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bVal - aVal;
      })
      .slice(0, 4),
  );

  topProducts = computed(() => this.products().slice(0, 4));

  ngOnInit() {
    this.loaderService.show();

    const adminSub = this.adminAuthService.currentUser$.subscribe((user) => {
      // if (user?.displayName) {
      //   this.adminName = user.displayName;
      // }
      if (user) {
        this.adminName = user.displayName || user.email || 'Admin';
      }
    });

    // Users
    const userSub = this.userService.getUsers().subscribe({
      next: (res) => {
        const data = (res || []).map((u: any) => ({
          ...u,
          createdAt: u.createdAt?.toDate ? u.createdAt.toDate() : u.createdAt,
        }));
        this.users.set(data);
      },
      error: (err) => console.error('Users load error:', err),
    });

    // Products
    const productSub = this.productService.getProducts().subscribe({
      next: (res) => this.products.set(res || []),
      error: (err) => console.error('Products load error:', err),
    });

    // Orders
    const orderSub = this.orderService.getAllOrders().subscribe({
      next: (res) => {
        this.orders.set(res || []);
        this.loaderService.hide();
      },
      error: (err) => {
        console.error('Orders load error:', err);
        this.loaderService.hide();
      },
    });

    this.destroyRef.onDestroy(() => {
      adminSub.unsubscribe();
      userSub.unsubscribe();
      productSub.unsubscribe();
      orderSub.unsubscribe();
    });
  }

  getInitials(nameOrEmail: string): string {
    if (!nameOrEmail) return '?';
    const parts = nameOrEmail.split(/[\s@]/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  getAvatarBg(email: string): string {
    const colors = [
      '#E6F1FB',
      '#EAF3DE',
      '#FAEEDA',
      '#FAECE7',
      '#FBEAF0',
      '#EEEDFE',
      '#E1F5EE',
      '#FCEBEB',
    ];
    let hash = 0;
    for (const ch of email || '') hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  getDiscountPrice(item: Product): number {
    return this.productService.getDiscountPrice(item);
  }

  // getDiscountPrice(product: Product): number {
  //   if (!product.discount || product.discount <= 0) return product.price;
  //   return product.price - (product.price * product.discount) / 100;
  // }
}
