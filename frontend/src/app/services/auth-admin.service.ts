import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';

import { ApiService, fireAndShare } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { User } from '../models/user.model';

/**
 * Admin-side auth. /auth/admin/login accepts only role 'admin' and refuses everyone else,
 * so the customer/admin split is enforced by the API rather than by this service.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private router = inject(Router);

  readonly currentUser$: Observable<User | null> = this.session.user$;

  readonly isAdmin$: Observable<boolean> = this.session.user$.pipe(
    map((user) => user?.role === 'admin'),
  );

  loginAdmin(email: string, password: string): Observable<User> {
    return this.api.post<{ user: User }>('/auth/admin/login', { email, password }).pipe(
      map((res) => res.user),
      tap((user) => {
        this.session.settle(user);
        if (this.api.isBrowser) localStorage.setItem('session_role', 'admin');
      }),
    );
  }

  /** Eager for the same reason as AuthService.logout() — admin-header does not subscribe. */
  logout(): Observable<void> {
    return fireAndShare(
      this.api.post<void>('/auth/logout').pipe(
        tap(() => {
          if (this.api.isBrowser) localStorage.removeItem('session_role');
          this.session.clear();
          this.router.navigateByUrl('/admin/login', { replaceUrl: true });
        }),
      ),
    );
  }
}
