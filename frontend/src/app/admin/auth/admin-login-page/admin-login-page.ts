import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminAuthService } from '../../../services/auth-admin.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatProgressSpinnerModule],
  templateUrl: './admin-login-page.html',
  styleUrl: './admin-login-page.css',
})
export class AdminLoginPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private adminAuthService = inject(AdminAuthService);
  private snackBar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  isLoading = signal(false);

  loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit() {
    const sub = this.adminAuthService.isAdmin$.subscribe((isAdmin) => {
      if (isAdmin) {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/dashboard';
        this.router.navigateByUrl(returnUrl);
        // this.router.navigate(['/admin']);
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.getRawValue();

    this.isLoading.set(true);

    this.adminAuthService.loginAdmin(email, password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.snackBar.success('Admin login successfully!');

        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/dashboard';
        this.router.navigateByUrl(returnUrl);
        // this.router.navigate(['/admin']);
      },

      error: (error: any) => {
        let message = 'Login failed';

        if (error.message === 'Unauthorized') {
          message = 'Only admin can login';
        }

        if (error.message === 'Admin not found') {
          message = 'Admin not found';
        }

        this.snackBar.error(message);

        console.error(error);
        this.isLoading.set(false);
      },
    });
  }
}
///////////////////////////////////////////////////////////////////////////////////////////

// import { Component, inject } from '@angular/core';
// import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// import { Router } from '@angular/router';
// import { MatSnackBar } from '@angular/material/snack-bar';
// import { AdminAuthService } from '../../../services/admin-auth-service';

// @Component({
//   selector: 'app-admin-login-page',
//   standalone: true,
//   imports: [ReactiveFormsModule],
//   templateUrl: './admin-login-page.html',
//   styleUrl: './admin-login-page.css',
// })
// export class AdminLoginPage {
//   private router = inject(Router);
//   private adminAuthService = inject(AdminAuthService);
//   private snackBar = inject(MatSnackBar);

//   loginForm = new FormGroup({
//     email: new FormControl('', [Validators.required, Validators.email]),
//     password: new FormControl('', [Validators.required]),
//   });

//   async onSubmit() {
//     if (this.loginForm.invalid) return;

//     const email = this.loginForm.value.email!;
//     const password = this.loginForm.value.password!;

//     try {
//       await this.adminAuthService.loginAdmin(email, password);

//       this.snackBar.open('Admin login successful!', 'Close', {
//         duration: 3000,
//         panelClass: ['snackbar-success'],
//       });

//       this.router.navigate(['/admin']);
//     } catch (err: any) {
//       let message = 'Login failed';

//       if (err.message === 'Not an admin user') {
//         message = 'Access denied: Not an admin';
//       }

//       this.snackBar.open(message, 'Close', {
//         duration: 3000,
//         panelClass: ['snackbar-error'],
//       });
//     }
//   }
// }
