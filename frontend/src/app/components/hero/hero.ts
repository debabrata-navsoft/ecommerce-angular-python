import { Component, inject, PLATFORM_ID, DestroyRef, signal, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);

  images = [
    '/banner/banner1.jpg',
    '/banner/banner2.jpg',
    '/banner/banner3.jpg',
    '/banner/banner4.jpg',
    '/banner/banner5.jpg',
    '/banner/banner6.jpg',
  ];

  currentIndex = signal(0);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.ngZone.runOutsideAngular(() => {
      interval(2000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.currentIndex.update((index) => (index + 1) % this.images.length);
          });
        });
    });
  }
}
