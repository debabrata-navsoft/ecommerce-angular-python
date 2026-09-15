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

import { ProductService } from '../../../../services/product.service';
import { Product } from '../../../../models/product.model';

@Component({
  selector: 'app-mobiles',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './mobiles.html',
  styleUrl: './mobiles.css',
})
export class Mobiles implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  category = input('mobiles');
  totalLimit = input(24);
  // @Input() category: string = 'mobiles';  // old version
  // @Input() totalLimit = 24;  // old version

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

  ngOnInit() {
    const sub = this.productService.getProductsByCategory(this.category()).subscribe({
      next: (res: Product[]) => {
        this.products.set(res);
      },
      error: (err) => {
        console.log(err);
      },
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
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
