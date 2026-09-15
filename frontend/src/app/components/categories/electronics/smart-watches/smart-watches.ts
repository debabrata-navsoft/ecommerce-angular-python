import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../models/product.model';

@Component({
  selector: 'app-smart-watches',
  standalone: true,
  imports: [],
  templateUrl: './smart-watches.html',
  styleUrl: './smart-watches.css',
})
export class SmartWatches implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  category = input('smart-watches');
  // @Input() category: string = 'smart-watches'; // old version
  products = signal<Product[]>([]);

  ngOnInit(): void {
    const productSub = this.productService.getProductsByCategory(this.category()).subscribe({
      next: (res: Product[]) => {
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
