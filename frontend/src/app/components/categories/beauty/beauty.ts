import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-beauty',
  standalone: true,
  imports: [],
  templateUrl: './beauty.html',
  styleUrl: './beauty.css',
})
export class Beauty implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  category = input('beauty');
  // @Input() category: string = 'beauty';  // old version

  products = signal<Product[]>([]);

  ngOnInit(): void {
    const productSub = this.productService.getProductsByCategory(this.category()).subscribe({
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
