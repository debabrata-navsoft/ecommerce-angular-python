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
  selector: 'app-home-living',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './home-living.html',
  styleUrl: './home-living.css',
})
export class HomeLiving implements OnInit {
  private router = inject(Router);
  private productsService = inject(ProductService);
  private destroyRef = inject(DestroyRef);

  category = input('home-living');
  totalLimit = input(24);
  // @Input() category: string = 'home-living';  // old version
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

    return this.products().slice(start, end);
  });

  ngOnInit(): void {
    const productSub = this.productsService.getProductsByCategory(this.category()).subscribe({
      next: (res: Product[]) => {
        this.products.set(res);
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
