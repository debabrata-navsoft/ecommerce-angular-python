import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { ApiService, fireAndShare } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { User } from '../models/user.model';

/**
 * Customer-side auth against the Node API. `login()` hits /auth/login, which accepts only
 * role 'user' — an admin credential is rejected there, so the rule that used to live in
 * this service is now enforced server-side and cannot be bypassed by calling the API
 * directly.
 *
 * `currentUser$` is the stream and `currentUser` the signal — both read the one session
 * resolved by SessionService.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private session = inject(SessionService);

  readonly currentUser$: Observable<User | null> = this.session.user$;

  readonly currentUser = this.session.user;
  readonly isAuthReady = this.session.isReady;

  signupUser(data: User, password: string): Observable<User> {
    return this.api
      .post<{ user: User }>('/auth/signup', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber ?? [],
        password,
      })
      .pipe(
        map((res) => res.user),
        tap((user) => {
          this.session.settle(user);
          this.setSessionRole('user');
        }),
      );
  }

  login(email: string, password: string): Observable<User> {
    return this.api.post<{ user: User }>('/auth/login', { email, password }).pipe(
      map((res) => res.user),
      tap((user) => {
        this.session.settle(user);
        this.setSessionRole('user');
      }),
    );
  }

  /**
   * Eager: header, navbar and admin-header all call `logout()` without subscribing. Cold,
   * that would leave the session cookie in place and the user still signed in after a
   * refresh. `profile-page` does subscribe, and shareReplay keeps that working.
   */
  logout(): Observable<void> {
    return fireAndShare(
      this.api.post<void>('/auth/logout').pipe(
        tap(() => {
          this.clearSessionRole();
          this.session.clear();
        }),
      ),
    );
  }

  isLoggedIn(): boolean {
    return this.isAuthReady() && !!this.currentUser();
  }

  getFullUser(): Observable<User | null> {
    return this.currentUser$;
  }

  updateUserDetails(changes: Partial<User>): Observable<void> {
    return this.api.patch<{ user: User }>('/auth/me', changes).pipe(
      tap((res) => this.session.settle(res.user)),
      map(() => void 0),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api.post<void>('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * The session cookie is shared across tabs, so a customer and admin login can still
   * clash. `session_role` records which area signed in last, and the guards compare it
   * against the role on the user document to detect a leak — keep both halves of that
   * check in place.
   */
  private setSessionRole(role: 'user' | 'admin'): void {
    if (this.api.isBrowser) localStorage.setItem('session_role', role);
  }

  private clearSessionRole(): void {
    if (this.api.isBrowser) localStorage.removeItem('session_role');
  }
}
