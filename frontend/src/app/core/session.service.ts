import { inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, filter, map, Observable, of, tap } from 'rxjs';

import { User } from '../models/user.model';
import { ApiService } from './api.service';

/**
 * Owns the signed-in user. Both AuthService and AdminAuthService read from it, so the app
 * resolves the session once rather than once per service.
 *
 * The subject starts as `undefined` meaning "not resolved yet", and `user$` filters that
 * out. Guards do `user$.pipe(take(1))`, so this is what makes them wait for the real
 * answer instead of seeing a premature `null` and bouncing a logged-in user to /login on
 * a hard refresh — the same guarantee `authState` used to provide.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private api = inject(ApiService);

  private subject = new BehaviorSubject<User | null | undefined>(undefined);

  readonly user$: Observable<User | null> = this.subject
    .asObservable()
    .pipe(filter((value): value is User | null => value !== undefined));

  readonly user = signal<User | null>(null);
  readonly isReady = signal(false);

  constructor() {
    // Runs on the server too: ApiService forwards the visitor's cookie during SSR, so the
    // server render knows who is signed in and emits the logged-in header rather than a
    // Login button the browser then has to correct.
    //
    // Angular's HTTP transfer cache carries this response into the client, so the browser
    // resolves the same user without a second round trip — which is also what keeps the
    // `@if (authReady)` block from differing between server and client and tripping a
    // hydration mismatch.
    this.refresh().subscribe();
  }

  /** Re-reads the session from the API. A 401 simply means "not signed in". */
  refresh(): Observable<User | null> {
    return this.api.get<{ user: User | null }>('/auth/me').pipe(
      map((res) => res.user),
      catchError(() => of(null)),
      tap((user) => this.settle(user)),
    );
  }

  settle(user: User | null): void {
    this.subject.next(user);
    this.user.set(user);
    this.isReady.set(true);
  }

  clear(): void {
    this.settle(null);
  }

  get uid(): string | undefined {
    return this.user()?.uid;
  }
}
