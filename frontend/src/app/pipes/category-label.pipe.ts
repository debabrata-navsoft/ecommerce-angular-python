import { Pipe, PipeTransform } from '@angular/core';
import { CATEGORIES } from '../data/category.data';

@Pipe({
  name: 'categoryLabel',
})
export class CategoryLabelPipe implements PipeTransform {
  transform(slug: string): string {
    if (!slug) return '';

    const normalized = slug.toLowerCase().trim();

    const mainCategory = CATEGORIES.find(
      (cat) => cat.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-') === normalized,
    );
    if (mainCategory) return mainCategory.name;

    for (const cat of CATEGORIES) {
      const sub = cat.subcategories.find((s) => s.slug === normalized);
      if (sub) return sub.label;
    }

    return normalized
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
