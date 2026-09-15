import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIcon, MatIconModule } from '@angular/material/icon';

import { ProductService } from '../../../services/product.service';
import { Product, ProductField } from '../../../models/product.model';
import { SnackbarService } from '../../../services/snackbar.service';
import { LoaderService } from '../../../services/loader.service';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-add-product',
  standalone: true,
  imports: [FormsModule, MatSnackBarModule, CommonModule, MatIcon, MatIconModule, Loader],
  templateUrl: './add-product.html',
  styleUrl: './add-product.css',
})
export class AddProduct implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private snackBar = inject(SnackbarService);
  private loaderService = inject(LoaderService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;

  editId = signal<string | null>(null);
  isEdit = signal(false);
  extraFields = signal<{ label: string; value: string }[]>([]);

  product = signal<Partial<Product>>({
    title: '',
    price: 0,
    discount: 0,
    stock: 0,
    brand: '',
    color: '',
    category: '',
    subCategory: '',
    image: '',
    description: '',
    rating: 0,
  });

  touched = signal({
    title: false,
    price: false,
    discount: false,
    stock: false,
    brand: false,
    color: false,
    category: false,
    subCategory: false,
    image: false,
    description: false,
    rating: false,
  });

  ngOnInit(): void {
    this.editId.set(this.route.snapshot.paramMap.get('id'));

    if (this.editId()) {
      this.isEdit.set(true);

      const productSub = this.productService.getProductById(this.editId()!).subscribe({
        next: (res) => {
          if (res) {
            this.product.set(res);
          }
        },

        error: (err) => console.log(err),
      });

      this.destroyRef.onDestroy(() => {
        productSub.unsubscribe();
      });
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////

  addField() {
    this.extraFields.update((fields) => [...fields, { label: '', value: '' }]);
  }

  removeField(index: number) {
    this.extraFields.update((fields) => fields.filter((_, i) => i !== index));
  }

  updateExtraField(index: number, key: 'label' | 'value', value: string) {
    this.extraFields.update((fields) => {
      const updated = [...fields];
      updated[index] = {
        ...updated[index],
        [key]: value,
      };
      return updated;
    });
  }

  trackByIndex(index: number) {
    return index;
  }

  /////////////////////////////////////////////////////////

  updateField(field: ProductField, value: any) {
    this.product.update((p) => ({
      ...p,
      [field]: value,
    }));
  }

  markTouched(field: ProductField) {
    this.touched.update((t) => ({
      ...t,
      [field]: true,
    }));
  }

  isInvalid(field: ProductField): boolean {
    const product = this.product();
    const touched = this.touched();

    const value = product[field];

    return touched[field] && (value === '' || value === null || value === undefined);
  }

  // isInvalid(field: ProductField): boolean {
  //   const product = this.product();
  //   const touched = this.touched();

  //   return !product[field] && touched[field];
  // }

  isFormValid = computed(() => {
    const p = this.product();

    return (
      !!p.title &&
      (p.price ?? 0) > 0 &&
      (p.discount ?? 0) >= 0 &&
      (p.stock ?? 0) >= 0 &&
      !!p.brand &&
      !!p.color &&
      !!p.category &&
      !!p.subCategory &&
      !!p.image &&
      !!p.description &&
      (p.rating ?? 0) >= 0 &&
      (p.rating ?? 0) <= 5
    );
  });

  onSubmit() {
    if (!this.isFormValid()) {
      this.snackBar.error('Please fill all required fields');
      return;
    }

    this.loaderService.show();

    const p = this.product();

    const finalProduct: Product = {
      id: this.editId() ?? '',
      title: p.title!,
      price: p.price!,
      discount: p.discount,
      stock: p.stock!,
      brand: p.brand!,
      color: p.color!,
      category: p.category!,
      subCategory: p.subCategory!,
      image: p.image!,
      description: p.description!,
      rating: p.rating,
      createdAt: Date.now(),
    };

    let sub;

    if (this.isEdit() && this.editId()) {
      sub = this.productService.updateProduct(this.editId()!, finalProduct).subscribe({
        next: () => {
          this.snackBar.success('Product Updated Successfully');
          this.loaderService.hide();
          this.router.navigate(['/admin/products']);
        },
        error: (err) => {
          this.loaderService.hide();
          this.snackBar.error('Something went wrong');
          console.error(err);
        },
      });
    } else {
      sub = this.productService.addProduct(finalProduct).subscribe({
        next: () => {
          this.snackBar.success('Product Added Successfully');
          this.loaderService.hide();
          this.router.navigate(['/admin/products']);
        },
        error: (err) => {
          this.loaderService.hide();
          this.snackBar.error('Something went wrong');
          console.error(err);
        },
      });
    }

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }
  //   onCancel() {
  //   this.router.navigate(['/admin/products']);
  // }

  onCancel() {
    this.location.back();
  }
}
