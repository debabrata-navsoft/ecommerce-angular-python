import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-jewellery',
  standalone: true,
  imports: [],
  templateUrl: './jewellery.html',
  styleUrl: './jewellery.css',
})
export class Jewellery implements OnInit {
  private router = inject(Router);
  private productService = inject(ProductService);
  private destroyRef = inject(DestroyRef);

  category = input('jewellery');
  // @Input() category: string = 'jewellery'; // old version

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
