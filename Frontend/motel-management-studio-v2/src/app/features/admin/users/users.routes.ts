import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./users-page/users-page.component').then((module) => module.UsersPageComponent),
    title: 'Usuarios del sistema · El Rapidin',
  },
];
