import { Component, DestroyRef, inject } from '@angular/core';

import { AdminAuthService } from '../../../services/auth-admin.service';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.css',
})
export class AdminHeader {
  private adminAuthService = inject(AdminAuthService);
  private snacbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  adminName = 'Admin';

  ngOnInit() {
    const adminAuthSub = this.adminAuthService.currentUser$.subscribe((user) => {
      // if (user?.displayName) {
      //   this.adminName = user.displayName;
      // }
      if (user) {
        this.adminName = user.displayName || user.email || 'Admin';
      }
    });

    this.destroyRef.onDestroy(() => {
      adminAuthSub.unsubscribe();
    });
  }

  logout() {
    this.adminAuthService.logout();
    this.snacbar.success('Admin logout successfully!');
  }
}
