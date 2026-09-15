import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../services/auth-user.service';
import { User } from '../../../models/user.model';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.css',
})
export class SignupPage {
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(SnackbarService);

  isLoading = signal(false);

  form = new FormGroup(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      lastName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
        // asyncValidators: [this.checkEmailAvailability()],
        // updateOn: 'blur',
      }),

      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),

      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),

      phoneNumber: new FormArray<FormControl<string>>([new FormControl('', { nonNullable: true })]),
    },
    {
      validators: [this.passwordMatch],
    },
  );

  passwordMatch(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;

    return password === confirm ? null : { passwordMismatch: true };
  }

  // checkEmailAvailability(): AsyncValidatorFn {
  //   return (control: AbstractControl) => {
  //     if (!control.value) return of(null);

  //     return from(this.authService.checkEmail(control.value)).pipe(
  //       map((exists) => (exists ? { emailTaken: true } : null)),
  //     );
  //   };
  // }

  get phoneNumber() {
    return this.form.get('phoneNumber') as FormArray;
  }

  addPhone() {
    this.phoneNumber.push(new FormControl('', { nonNullable: true }));
  }

  removePhone(index: number) {
    this.phoneNumber.removeAt(index);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.error('Please fill all fields correctly');
      return;
    }

    const value = this.form.getRawValue();

    const user: User = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      phoneNumber: value.phoneNumber.map((p: string) => p.trim()),
    };

    this.isLoading.set(true);

    this.authService.signupUser(user, value.password).subscribe({
      next: () => {
        this.snackBar.success('Signup successful');
        this.form.reset();
        this.isLoading.set(false);
        this.router.navigate(['/']);
      },

      error: (error: any) => {
        if (error.code === 'auth/email-already-in-use') {
          this.email.setErrors({ emailTaken: true });
          // this.snackBar.error('Email already exists');
        } else {
          this.snackBar.error('Signup failed');
        }

        console.error(error);
        this.isLoading.set(false);
      },
    });
  }

  get firstName() {
    return this.form.controls.firstName;
  }

  get lastName() {
    return this.form.controls.lastName;
  }

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }
}
