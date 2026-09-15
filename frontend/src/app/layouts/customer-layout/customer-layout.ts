import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { Header } from '../../components/header/header';
import { Footer } from '../../components/footer/footer';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './customer-layout.html',
  styleUrl: './customer-layout.css',
})
export class CustomerLayout {
  router = inject(Router);
  route = inject(ActivatedRoute);

  hideLayout = signal(false);
  hideBreadcrumb = signal(false);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateLayoutFlags(this.router.routerState.root);
      }
    });
  }

  private updateLayoutFlags(route: ActivatedRoute) {
    let current: ActivatedRoute | null = route;

    this.hideLayout.set(false);
    this.hideBreadcrumb.set(false);

    // const isAdminRoute = this.router.url.startsWith('/admin');

    // if (isAdminRoute) {
    //   this.hideLayout = true;
    //   this.hideBreadcrumb = true;
    //   return;
    // }

    while (current) {
      const data = current.snapshot.data;

      if (data?.['hideLayout']) {
        this.hideLayout.set(true);
      }

      if (data?.['hideBreadcrumb']) {
        this.hideBreadcrumb.set(true);
      }

      current = current.firstChild!;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////
  // constructor() {
  //   this.router.events.subscribe((event) => {
  //     if (event instanceof NavigationEnd) {
  //       let current = this.route.firstChild;

  //       while (current?.firstChild) {
  //         current = current.firstChild;
  //       }

  //       this.hideLayout = current?.snapshot.data['hideLayout'] ?? false;
  //       this.hideBreadcrumb = current?.snapshot.data['hideBreadcrumb'] ?? false;
  //     }
  //   });
  // }
}
