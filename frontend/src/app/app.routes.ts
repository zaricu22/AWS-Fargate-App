import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'items' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'callback',
    loadComponent: () =>
      import('./features/login/hosted-ui-callback.component').then((m) => m.HostedUiCallbackComponent),
  },
  {
    path: 'items',
    canActivate: [authGuard],
    loadComponent: () => import('./features/items/items.component').then((m) => m.ItemsComponent),
  },
  { path: '**', redirectTo: 'items' },
];
