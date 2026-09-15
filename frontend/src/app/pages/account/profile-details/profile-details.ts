import { Component, inject, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ProfileForm, User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth-user.service';
import { SnackbarService } from '../../../services/snackbar.service';

@Component({
  selector: 'app-profile-details',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile-details.html',
  styleUrl: './profile-details.css',
})
export class ProfileDetails {
  private authService = inject(AuthService);
  private snackbar = inject(SnackbarService);

  user = input<User | null>();
  userUpdated = output<User>();

  isEdit = signal(false);
  isSaving = signal(false);

  profileForm = signal<ProfileForm>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
  });

  // firstName = signal('');
  // lastName = signal('');
  // phoneNumber = signal('');

  constructor() {
    effect(() => {
      const u = this.user();
      if (u) {
        this.profileForm.set({
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          phoneNumber: u.phoneNumber?.[0] || '',
        });
        // this.firstName.set(u.firstName || '');
        // this.lastName.set(u.lastName || '');
        // this.phoneNumber.set(u.phoneNumber?.[0] || '');
      }
    });
  }

  updateField(field: keyof ProfileForm, value: string) {
    this.profileForm.update((form) => ({
      ...form,
      [field]: value,
    }));
  }

  edit() {
    this.isEdit.set(true);
  }

  cancel() {
    const u = this.user();
    if (!u) return;

    this.profileForm.set({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      phoneNumber: u.phoneNumber?.[0] || '',
    });
    this.isEdit.set(false);
    // this.firstName.set(u.firstName || '');
    // this.lastName.set(u.lastName || '');
    // this.phoneNumber.set(u.phoneNumber?.[0] || '');
    // this.isEdit.set(false);
  }

  save() {
    const u = this.user();
    const form = this.profileForm();

    if (!u?.uid) return;

    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNumber.trim()) {
      this.snackbar.error('Please fill all required fields');
      return;
    }

    this.isSaving.set(true);

    const updatedData: Partial<User> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phoneNumber: [form.phoneNumber.trim()],
    };

    this.authService.updateUserDetails(updatedData).subscribe({
      next: () => {
        this.userUpdated.emit({
          ...u,
          ...updatedData,
        });

        this.isEdit.set(false);
        this.isSaving.set(false);
        this.snackbar.success('Profile updated successfully');
      },
      error: () => {
        this.isSaving.set(false);
        this.snackbar.error('Failed to update profile');
      },
    });
  }

  // save() {
  //   const u = this.user();
  //   if (!u?.uid) return;

  //   this.isSaving.set(true);

  //   const updatedData: Partial<User> = {
  //     firstName: this.firstName().trim(),
  //     lastName: this.lastName().trim(),
  //     phoneNumber: [this.phoneNumber().trim()],
  //   };

  //   this.authService.updateUserDetails(updatedData).subscribe({
  //     next: () => {
  //       this.userUpdated.emit({
  //         ...u,
  //         ...updatedData,
  //       });

  //       this.isEdit.set(false);
  //       this.isSaving.set(false);
  //       this.snackbar.success('Profile updated successfully');
  //     },
  //     error: () => {
  //       this.isSaving.set(false);
  //       this.snackbar.error('Failed to update profile');
  //     },
  //   });

  //   // this.authService.updateUserDetails(u.uid, updatedData).subscribe({
  //   //   next: () => {
  //   //     this.userUpdated.emit({
  //   //       ...u,
  //   //       ...updatedData,
  //   //     });

  //   //     this.isEdit.set(false);
  //   //     this.isSaving.set(false);
  //   //     this.snackbar.success('Profile updated successfully');
  //   //   },
  //   //   error: (err) => {
  //   //     console.error(err);
  //   //     this.isSaving.set(false);
  //   //     this.snackbar.error('Failed to update profile');
  //   //   },
  //   // });
  // }
}

// import { Component, input } from '@angular/core';
// import { User } from '../../../models/user.model';

// @Component({
//   selector: 'app-profile-details',
//   standalone: true,
//   imports: [],
//   templateUrl: './profile-details.html',
//   styleUrl: './profile-details.css',
// })
// export class ProfileDetails {
//   user = input<User | null>();
// }
