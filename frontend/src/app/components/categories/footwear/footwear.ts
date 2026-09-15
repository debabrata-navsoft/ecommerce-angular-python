import { Component, DestroyRef, inject, input, Input, OnInit, signal } from '@angular/core';
import { ProductService } from '../../../services/product.service';

import { Product } from '../../../models/product.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-footwear',
  standalone: true,
  imports: [],
  templateUrl: './footwear.html',
  styleUrl: './footwear.css',
})
export class Footwear implements OnInit {
  private protectService = inject(ProductService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  category = input('footwear');
  // @Input() category: string = 'footwear';  // old version

  products = signal<Product[]>([]);

  ngOnInit(): void {
    const productSub = this.protectService.getProductsByCategory(this.category()).subscribe({
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
