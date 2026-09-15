import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AddressUser, User } from '../../../../models/user.model';
import { UserService } from '../../../../services/user.service';
import { SnackbarService } from '../../../../services/snackbar.service';

@Component({
  selector: 'app-checkout-address',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './checkout-address.html',
  styleUrl: './checkout-address.css',
})
export class CheckoutAddress {
  private userService = inject(UserService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  user = input<User | null>();
  addressSelected = output<AddressUser>();

  userData = signal<User | null>(null);
  editingIndex = signal<number | null>(null);
  selectedAddress = signal<AddressUser | null>(null);
  selectedIndex = signal<number | null>(null);

  showAll = signal(false);
  showAddressPopup = signal(false);

  newAddress = signal<AddressUser>({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pinCode: '',
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (!u?.uid) return;

      const userSub = this.userService.getUserById(u.uid).subscribe((user) => {
        this.userData.set(user);
      });
      this.destroyRef.onDestroy(() => {
        userSub.unsubscribe();
      });
    });
  }

  ngAfterViewInit() {}

  editAddress(addr: AddressUser, index: number) {
    this.newAddress.set({ ...addr });
    this.editingIndex.set(index);
    this.showAddressPopup.set(true);
  }

  selectAddress(addr: AddressUser, index: number) {
    this.selectedAddress.set(addr);
    this.selectedIndex.set(index);
    this.addressSelected.emit(addr);
  }

  visibleAddresses = computed(() => {
    const addresses = this.userData()?.addresses || [];
    const indexed = addresses.map((addr, index) => ({ addr, index }));
    return this.showAll() ? indexed : indexed.slice(0, 2);
  });

  toggleShowAll() {
    this.showAll.update((v) => !v);
  }

  openPopup() {
    const u = this.userData();

    this.newAddress.set({
      fullName: `${u?.firstName || ''} ${u?.lastName || ''}`.trim(),
      email: u?.email || '',
      phone: u?.phoneNumber?.[0] || '',
      address: '',
      landmark: '',
      city: '',
      state: '',
      pinCode: '',
    });
    this.editingIndex.set(null);
    this.showAddressPopup.set(true);
  }

  updateField(field: keyof AddressUser, value: string) {
    this.newAddress.update((a) => ({ ...a, [field]: value }));
  }

  saveAddress() {
    const u = this.userData();
    if (!u?.uid) return;

    const base = this.newAddress();

    if (
      !base.fullName ||
      !base.phone ||
      !base.address ||
      !base.city ||
      !base.state ||
      !base.pinCode
    ) {
      this.snackbar.error('Fill all required fields');
      return;
    }

    const clean: AddressUser = {
      ...base,
      phone: String(base.phone ?? '').trim(),
      pinCode: String(base.pinCode ?? '').trim(),
      landmark: base.landmark?.trim() || '',
    };

    // The server assigns the id and the ordering, so edits target an id rather than an
    // array index and the response replaces the local list.
    const idx = this.editingIndex();
    const editingId = idx !== null ? this.userData()?.addresses?.[idx]?.id : undefined;

    const request = editingId
      ? this.userService.updateAddress(u.uid, editingId, clean)
      : this.userService.addAddress(u.uid, clean);

    request.subscribe({
      next: (addresses) => {
        this.userData.set({ ...u, addresses });

        this.editingIndex.set(null);
        this.showAddressPopup.set(false);

        // Newly added addresses come back first (the API sorts newest-first).
        const newIndex = editingId ? idx! : 0;
        if (addresses[newIndex]) this.selectAddress(addresses[newIndex], newIndex);

        this.snackbar.success(editingId ? 'Address updated' : 'Address added');
      },

      error: (err: Error) => {
        this.snackbar.error(err.message || 'Failed to save address');
      },
    });
  }
}
