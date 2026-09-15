export interface Category {
  name: string;
  subcategories: {
    label: string;
    slug: string;
  }[];
}

// export interface Category {
//   name: string;
//   subcategories: string[];
// }
