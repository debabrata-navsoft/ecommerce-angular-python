import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../services/auth-user.service';
import { User } from '../../models/user.model';
import { Category } from '../../models/category.model';
import { CATEGORIES } from '../../data/category.data';
import { MENU, MenuItem } from '../../data/menu.data';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, MatSnackBarModule, MatIconModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private snackBar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  user = signal<User | null>(null);
  selectedCategory = signal<Category | null>(null);

  dropdownTop = signal(0);
  dropdownLeft = signal(0);
  isMenuOpen = signal(false);
  isSidebarOpen = signal(false);
  isDropdownOpen = signal(false);

  menu = signal(MENU);
  categories = signal(CATEGORIES);

  get authReady() {
    return this.authService.isAuthReady();
  }

  get isLoggedIn() {
    return this.authService.isLoggedIn();
  }

  ngOnInit() {
    const sub = this.authService.getFullUser().subscribe({
      next: (user) => {
        this.user.set(user);
      },
      error: (err) => {
        console.error(err);
      },
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  logout() {
    this.authService.logout();
    this.isMenuOpen.set(false);

    this.snackBar.success('Logged out successfully');

    this.router.navigate(['/']);
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  closeMenu() {
    this.isMenuOpen.set(false);
  }

  toggleSidebar() {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  openDropdown(category: Category, event: MouseEvent) {
    this.selectedCategory.set(category);
    this.isDropdownOpen.set(true);

    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.dropdownLeft.set(rect.left);
    this.dropdownTop.set(rect.bottom);
  }

  closeDropdown() {
    this.isDropdownOpen.set(false);
  }

  goToMainCategory(cat: Category) {
    this.router.navigate(['/products'], {
      queryParams: {
        main: cat.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-'),
        // main: cat.name.toLowerCase().trim(),
        category: 'all',
      },
    });

    this.closeDropdown();
  }

  // goToSubCategory(sub: string) {
  //   this.router.navigate(['/products'], {
  //     queryParams: {
  //       main: this.selectedCategory!.name.toLowerCase().trim(),
  //       category: sub.toLowerCase().trim(),
  //     },
  //   });

  //   this.closeDropdown();
  // }

  // goToMainCategory(cat: string) {
  //   this.router.navigate(['/products'], {
  //     queryParams: {
  //       main: cat.toLowerCase().trim(),
  //       category: 'all',
  //     },
  //   });

  //   this.closeDropdown();
  // }

  goToSubCategory(sub: { label: string; slug: string }) {
    this.router.navigate(['/products'], {
      queryParams: {
        main: this.selectedCategory()!.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-'),
        // main: this.selectedCategory!.name.toLowerCase().trim(),
        category: sub.slug,
      },
    });

    this.closeDropdown();
  }

  onMenuItemClick(item: MenuItem) {
    if (item.path) {
      this.router.navigate([item.path]);
    } else if (item.category) {
      this.router.navigate(['/products'], {
        queryParams: { main: item.category, category: 'all' },
      });
    }
    this.closeSidebar();
  }
}
