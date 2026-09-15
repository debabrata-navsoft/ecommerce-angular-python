export interface Product {
  id: string;
  title: string;
  searchName?: string;
  price: number;
  stock: number;
  brand: string;
  color: string;
  category: string;
  subCategory: string;
  image: string;

  description: string;
  sales?: number;
  views?: number;
  discount?: number;
  discountPrice?: number;
  rating?: number;
  createdAt?: number;
}

export type ProductField =
  | 'title'
  | 'price'
  | 'discount'
  | 'stock'
  | 'brand'
  | 'color'
  | 'category'
  | 'subCategory'
  | 'image'
  | 'description'
  | 'rating';
