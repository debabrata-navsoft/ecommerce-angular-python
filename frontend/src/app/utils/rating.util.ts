export class Rating {
  static getStars(rating: number): string[] {
    const stars: string[] = [];
    const full = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    for (let i = 0; i < full; i++) stars.push('full');
    if (hasHalf) stars.push('half');
    while (stars.length < 5) stars.push('empty');

    return stars;
  }
}
