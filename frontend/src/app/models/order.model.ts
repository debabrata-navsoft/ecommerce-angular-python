export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  discount?: number;
}

export interface OrderAddress {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface Order {
  orderId?: string;
  userId: string;
  userEmail?: string;
  items: OrderItem[];
  address: OrderAddress;
  subTotal: number;
  gst: number;
  total: number;
  shippingMethod: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: number | null;
}
