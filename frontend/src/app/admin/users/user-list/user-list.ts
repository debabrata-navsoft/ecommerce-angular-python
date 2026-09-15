import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';

import { UserService } from '../../../services/user.service';
import { LoaderService } from '../../../services/loader.service';
import { User } from '../../../models/user.model';
import { Loader } from '../../../components/loader/loader';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIcon, MatPaginatorModule, Loader],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList implements OnInit {
  private userService = inject(UserService);
  private loaderService = inject(LoaderService);
  private destroyRef = inject(DestroyRef);

  isLoading = this.loaderService.isLoading;

  users = signal<User[]>([]);
  sortDirection = signal<'asc' | 'desc'>('desc');
  // sortDirection = signal<'asc' | 'desc'>('asc');
  pageSize = signal(10);
  pageIndex = signal(0);

  ngOnInit() {
    this.loaderService.show();

    const sub = this.userService.getUsers().subscribe({
      next: (res) => {
        const data = (res || []).map((u: any) => ({
          ...u,
          createdAt: u.createdAt?.toDate ? u.createdAt.toDate() : u.createdAt,
        }));

        this.users.set(data);
        this.loaderService.hide();
      },

      error: (err) => {
        console.error(err);
        this.loaderService.hide();
      },
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  toggleSort() {
    this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    this.pageIndex.set(0);
  }

  sortedUsers = computed(() => {
    const dir = this.sortDirection();

    return [...this.users()].sort((a: any, b: any) => {
      const aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return dir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  });

  paginatedUsers = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();

    return this.sortedUsers().slice(start, end);
  });

  totalItems = computed(() => this.users().length);

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;

    this.userService.deleteUser(id).subscribe(() => {
      this.users.update((users) => users.filter((u) => u.uid !== id));
    });
  }
}
