import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-baby-kids',
  standalone: true,
  imports: [],
  templateUrl: './baby-kids.html',
  styleUrl: './baby-kids.css',
})
export class BabyKids implements OnInit {
  private router = inject(Router);
  private productsService = inject(ProductService);
  private destroyRef = inject(DestroyRef);

  category = input('baby-kids');
  // @Input() category: string = 'baby-kids';  // old version

  products = signal<Product[]>([]);

  ngOnInit(): void {
    const productSub = this.productsService.getProductsByCategory(this.category()).subscribe({
      next: (res: Product[]) => {
        this.products.set(res.slice(0, 4));
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
