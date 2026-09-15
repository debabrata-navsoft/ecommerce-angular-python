import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, of, take } from 'rxjs';

import { SessionService } from '../core/session.service';

/**
 * Admin-area guard, the mirror of authGuard. `session.user$` withholds its first emission
 * until the session has actually been resolved, which is what `auth.authStateReady()`
 * used to buy us — without it a hard refresh of /admin would bounce a signed-in admin.
 *
 * Keeps the dual check: the role on the user plus `session_role`, so a customer session
 * shared through the same cookie cannot sit in an admin tab.
 */
export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const session = inject(SessionService);

  const isLoginPage = state.url.startsWith('/admin/login');

  if (!isPlatformBrowser(platformId)) return of(true);

  return session.user$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        return isLoginPage ? true : router.createUrlTree(['/admin/login']);
      }

      const isAdmin = user.role === 'admin';
      const sessionRole = localStorage.getItem('session_role');

      // A customer's session leaked into the admin tab.
      if (!isAdmin || sessionRole === 'user') {
        return isLoginPage ? true : router.createUrlTree(['/admin/login']);
      }

      if (isLoginPage) {
        return router.createUrlTree(['/admin/dashboard']);
      }

      return true;
    }),
  );
};
