import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIcon } from '@angular/material/icon';

import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { SnackbarService } from '../../../services/snackbar.service';
import { LoaderService } from '../../../services/loader.service';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterLink, CommonModule, MatIcon, TruncatePipe, MatPaginatorModule, Loader],
  templateUrl: './product-list-table.html',
  styleUrl: './product-list-table.css',
})
export class ProductListTable implements OnInit {
  private productService = inject(ProductService);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(SnackbarService);
  private loaderService = inject(LoaderService);

  isLoading = this.loaderService.isLoading;

  products = signal<Product[]>([]);
  searchTerm = signal('');
  sortDirection = signal<'asc' | 'desc'>('desc');
  // sortDirection = signal<'asc' | 'desc'>('asc')
  pageSize = signal(5);
  pageIndex = signal(0);
  totalItems = computed(() => this.filteredProducts().length);

  ngOnInit() {
    this.loaderService.show();

    const sub = this.productService.getProducts().subscribe({
      next: (res) => {
        this.products.set(res || []);
        this.loaderService.hide();
      },
      error: (err) => {
        this.products.set([]);
        this.loaderService.hide();
        console.error('Product load error:', err);
      },
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase();

    return this.products().filter((product) => product.title?.toLowerCase().includes(term));
  });

  sortedProducts = computed(() => {
    const direction = this.sortDirection();

    return [...this.filteredProducts()].sort((a: any, b: any) => {
      const aVal = a.createdAt?.seconds || a.createdAt || 0;
      const bVal = b.createdAt?.seconds || b.createdAt || 0;

      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  });

  paginatedProducts = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();

    return this.sortedProducts().slice(start, end);
  });

  updateSearch(value: string) {
    this.searchTerm.set(value);
    this.pageIndex.set(0);
  }

  toggleSort() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    this.pageIndex.set(0);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  getDiscountPrice(product: Product): number {
    if (!product.discount || product.discount <= 0) {
      return product.price;
    }

    return product.price - (product.price * product.discount) / 100;
  }

  deleteProduct(id: string) {
    const confirmDelete = confirm('Are you sure you want to delete this product?');
    if (!confirmDelete) return;

    this.productService.deleteProduct(id).subscribe({
      next: () => {
        console.log('Product deleted');
        this.snackBar.success('Product deleted successfully');
      },
      error: (err) => {
        console.error('Delete failed', err);
      },
    });
  }

  // deleteProduct(id: string) {
  //   this.productService.deleteProduct(id);
  // }
}
