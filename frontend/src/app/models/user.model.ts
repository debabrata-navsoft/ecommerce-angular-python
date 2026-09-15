export interface AddressUser {
  id?: string;
  createdAt?: number;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string | number;
}

export interface User {
  uid?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string[];
  role?: 'user' | 'admin';

  /** Virtual on the API's user model: `${firstName} ${lastName}`. Read-only. */
  displayName?: string;

  addresses?: AddressUser[];
  createdAt?: any;
}

export type ProfileForm = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
};
