export type PaymentMethod = 'cod' | 'upi' | 'card' | 'emi' | 'netbanking';

export type PaymentStatus = 'pending' | 'paid' | 'confirmed' | 'failed';

export interface PaymentData {
  userId: string;
  userEmail: string;
  total: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  razorpayPaymentId?: string;
  address: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
}
