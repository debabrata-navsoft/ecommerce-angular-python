import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiService } from '../core/api.service';
import { AddressUser, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  getUsers(): Observable<User[]> {
    return this.api.get<{ items: User[] }>('/users').pipe(map((res) => res.items));
  }

  getUserById(uid: string): Observable<User> {
    return this.api.get<{ user: User }>(`/users/${uid}`).pipe(map((res) => res.user));
  }

  updateUser(uid: string, changes: Partial<User>): Observable<User> {
    return this.api.patch<{ user: User }>(`/users/${uid}`, changes).pipe(map((res) => res.user));
  }

  deleteUser(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }

  /**
   * Addresses are addressed by id rather than array index. The old whole-array write
   * (`updateUserAddress(uid, { addresses })`) silently discarded any address added from
   * another tab between the read and the write; each of these touches only one entry and
   * returns the server's current list.
   */
  getAddresses(uid: string): Observable<AddressUser[]> {
    return this.api
      .get<{ items: AddressUser[] }>(`/users/${uid}/addresses`)
      .pipe(map((res) => res.items));
  }

  addAddress(uid: string, address: AddressUser): Observable<AddressUser[]> {
    return this.api
      .post<{ items: AddressUser[] }>(`/users/${uid}/addresses`, address)
      .pipe(map((res) => res.items));
  }

  updateAddress(uid: string, addressId: string, address: AddressUser): Observable<AddressUser[]> {
    return this.api
      .patch<{ items: AddressUser[] }>(`/users/${uid}/addresses/${addressId}`, address)
      .pipe(map((res) => res.items));
  }

  deleteAddress(uid: string, addressId: string): Observable<AddressUser[]> {
    return this.api
      .delete<{ items: AddressUser[] }>(`/users/${uid}/addresses/${addressId}`)
      .pipe(map((res) => res.items));
  }
}
