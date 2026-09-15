import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AddressUser, User } from '../../../models/user.model';
import { SnackbarService } from '../../../services/snackbar.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-address',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './address.html',
  styleUrl: './address.css',
})
export class Address {
  private userService = inject(UserService);
  private snackBar = inject(SnackbarService);

  user = input<User | null>();

  /**
   * Local copy of the list. Every address mutation returns the authoritative array, so
   * this signal holds it and the template reads from here rather than from `user()`,
   * which is only the initial seed.
   */
  addresses = signal<AddressUser[]>([]);

  showAddressPopup = signal(false);
  editAddressIndex = signal<number | null>(null);
  saving = signal(false);

  private editingId = computed(() => {
    const index = this.editAddressIndex();
    return index === null ? null : (this.addresses()[index]?.id ?? null);
  });

  newAddress = signal<AddressUser>(emptyAddress());

  constructor() {
    // Re-seed whenever the parent supplies a user (or a fresh one after a profile save).
    effect(() => {
      const current = this.user();
      if (current) this.addresses.set(current.addresses ?? []);
    });
  }

  updateField(field: keyof AddressUser, value: string) {
    this.newAddress.update((a) => ({ ...a, [field]: value }));
  }

  openAddressPopup() {
    const currentUser = this.user();
    if (!currentUser) return;

    this.newAddress.set({
      ...emptyAddress(),
      fullName: `${currentUser.firstName} ${currentUser.lastName}`,
      email: currentUser.email,
      phone: currentUser.phoneNumber?.[0] || '',
    });

    this.editAddressIndex.set(null);
    this.showAddressPopup.set(true);
  }

  editAddress(index: number) {
    const addr = this.addresses()[index];
    if (!addr) return;

    this.newAddress.set({ ...addr });
    this.editAddressIndex.set(index);
    this.showAddressPopup.set(true);
  }

  saveAddress() {
    const uid = this.user()?.uid;
    if (!uid || this.saving()) return;

    const clean = normalize(this.newAddress());

    if (
      !clean.fullName ||
      !clean.email ||
      !clean.phone ||
      !clean.address ||
      !clean.city ||
      !clean.state ||
      !clean.pinCode
    ) {
      this.snackBar.error('Please fill all required fields');
      return;
    }

    const editingId = this.editingId();
    const isEdit = editingId !== null;

    // Addressed by id, not array index — the server owns the ordering, and an
    // index-based write would clobber an address added from another tab.
    const request = isEdit
      ? this.userService.updateAddress(uid, editingId, clean)
      : this.userService.addAddress(uid, clean);

    this.saving.set(true);

    request.subscribe({
      next: (items) => {
        this.addresses.set(items);
        this.saving.set(false);
        this.editAddressIndex.set(null);
        this.showAddressPopup.set(false);
        this.snackBar.success(
          isEdit ? 'Address updated successfully' : 'Address saved successfully',
        );
      },
      error: (err: Error) => {
        this.saving.set(false);
        console.error(err);
        this.snackBar.error(err.message || 'Failed to save address');
      },
    });
  }

  deleteAddress(index: number) {
    const uid = this.user()?.uid;
    const addr = this.addresses()[index];
    if (!uid || !addr?.id) return;

    if (!confirm('Are you sure you want to delete this address?')) return;

    this.userService.deleteAddress(uid, addr.id).subscribe({
      next: (items) => {
        this.addresses.set(items);
        this.snackBar.success('Address deleted successfully');
      },
      error: () => this.snackBar.error('Delete failed'),
    });
  }
}

function emptyAddress(): AddressUser {
  return {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pinCode: '',
  };
}

function normalize(addr: AddressUser): AddressUser {
  return {
    fullName: addr.fullName.trim(),
    email: addr.email.trim(),
    phone: String(addr.phone ?? '').trim(),
    address: addr.address.trim(),
    landmark: addr.landmark?.trim() || '',
    city: addr.city.trim(),
    state: addr.state.trim(),
    pinCode: String(addr.pinCode ?? '').trim(),
  };
}
