import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-today-deals',
  standalone: true,
  imports: [],
  templateUrl: './today-deals.html',
  styleUrl: './today-deals.css',
})
export class TodayDeals implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  products = signal<Product[]>([]);

  ngOnInit(): void {
    const productSub = this.productService.getTodayDeals().subscribe({
      next: (res) => {
        this.products.set(res.slice(0, 4));
        console.log(res);
      },

      error: (err) => {
        console.log(err);
      },
    });

    this.destroyRef.onDestroy(() => {
      productSub.unsubscribe();
    });
  }

  viewDetails(id: string) {
    this.router.navigate(['/products', id]);
  }
}
