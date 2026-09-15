import { Category } from '../models/category.model';

export const CATEGORIES: Category[] = [
  {
    name: 'Electronics',
    subcategories: [
      { label: 'Mobiles', slug: 'mobiles' },
      { label: 'Laptops', slug: 'laptops' },
      { label: 'Headphones', slug: 'headphones' },
      { label: 'Smart Watches', slug: 'smart-watches' },
    ],
  },
  {
    name: 'Fashion',
    subcategories: [
      { label: "Men's Fashion", slug: 'mens-fashion' },
      { label: "Women's Fashion", slug: 'womens-fashion' },
    ],
  },
  {
    name: 'Bags',
    subcategories: [
      { label: 'Backpacks', slug: 'backpacks' },
      { label: 'Rucksack Travel Backpack', slug: 'rucksack-travel-backpack' },
      { label: 'Travel Bags', slug: 'travel-bags' },
    ],
  },
  {
    name: 'Footwear',
    subcategories: [
      { label: 'Sneakers', slug: 'sneakers' },
      { label: 'Sandals', slug: 'sandals' },
    ],
  },
  {
    name: 'Groceries',
    subcategories: [
      { label: 'Rice', slug: 'rice' },
      { label: 'Oil', slug: 'oil' },
      { label: 'Snacks', slug: 'snacks' },
    ],
  },
  {
    name: 'Beauty',
    subcategories: [
      { label: 'Makeup', slug: 'makeup' },
      { label: 'Skincare', slug: 'skincare' },
    ],
  },
  {
    name: 'Wellness',
    subcategories: [
      { label: 'Supplements', slug: 'supplements' },
      { label: 'Yoga', slug: 'yoga' },
    ],
  },
  {
    name: 'Jewellery',
    subcategories: [
      { label: 'Gold', slug: 'gold' },
      { label: 'Silver', slug: 'silver' },
      { label: 'Rings', slug: 'rings' },
    ],
  },

  {
    name: 'Home & Living',
    subcategories: [
      { label: 'Furniture', slug: 'furniture' },
      { label: 'Office Chair', slug: 'office-chair' },
      { label: 'Home Decor', slug: 'home-decor' },
      { label: 'Kitchenware', slug: 'kitchenware' },
      { label: 'Bedding & Bath', slug: 'bedding-bath' },
    ],
  },

  {
    name: 'Baby & Kids',
    subcategories: [
      { label: 'Baby care', slug: 'baby-care' },
      { label: 'Toys & Games', slug: 'toys-games' },
      { label: 'Kids’ clothing & accessories', slug: 'kids-clothing-accessories' },
    ],
  },

  {
    name: 'Pet Supplies',
    subcategories: [
      { label: 'Pet food', slug: 'pet-food' },
      { label: 'Grooming', slug: 'grooming' },
      { label: 'Accessories', slug: 'accessories' },
    ],
  },
];
