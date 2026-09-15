import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, of, take } from 'rxjs';

import { SessionService } from '../core/session.service';
import { SnackbarService } from '../services/snackbar.service';

/**
 * Customer-area guard. Also applied to /login and /signup, where it lets anonymous
 * visitors through and redirects anyone already signed in.
 *
 * The role now arrives on the session user, so there is no second document read. The
 * dual check is intact: because one auth cookie is shared across tabs, an admin session
 * can still surface here, and `session_role` records which area signed in last — either
 * signal being 'admin' bounces the visitor to the customer login.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const session = inject(SessionService);
  const snackBar = inject(SnackbarService);

  // Nothing to check during SSR: the render carries no cookie.
  if (!isPlatformBrowser(platformId)) return of(true);

  const url = state.url;
  const isAuthPage = url.startsWith('/login') || url.startsWith('/signup');

  return session.user$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        if (isAuthPage) return true;
        snackBar.error('Please login first');
        localStorage.setItem('redirectUrl', url);
        return router.createUrlTree(['/login']);
      }

      const sessionRole = localStorage.getItem('session_role');

      // An admin session leaked into the customer area.
      if (user.role === 'admin' || sessionRole === 'admin') {
        snackBar.error('Please login with a customer account.');
        return router.createUrlTree(['/login']);
      }

      if (isAuthPage) {
        snackBar.error('You are already logged in');
        return router.createUrlTree(['/']);
      }

      return true;
    }),
  );
};
