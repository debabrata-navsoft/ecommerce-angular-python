import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';

@Component({
  selector: 'app-trending',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './trending.html',
  styleUrl: './trending.css',
})
export class Trending implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  totalLimit = input(24);
  // @Input() totalLimit = 24; // old version

  products = signal<Product[]>([]);

  currentIndex = signal(0);
  pageSize = signal(8);

  fullProducts = computed(() => {
    return this.products().slice(0, this.totalLimit());
  });

  limitedProducts = computed(() => {
    const start = this.currentIndex();
    const end = start + this.pageSize();

    return this.fullProducts().slice(start, end);
  });

  ngOnInit(): void {
    const productSub = this.productService.getTrendingProducts().subscribe({
      next: (res) => {
        this.products.set(res);
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

  next() {
    const maxIndex = this.fullProducts().length - this.pageSize();

    if (this.currentIndex() < maxIndex) {
      this.currentIndex.set(this.currentIndex() + this.pageSize());
    }
  }

  prev() {
    if (this.currentIndex() > 0) {
      this.currentIndex.set(this.currentIndex() - this.pageSize());
    }
  }

  viewDetails(id: string) {
    this.router.navigate(['/products', id]);
  }
}
