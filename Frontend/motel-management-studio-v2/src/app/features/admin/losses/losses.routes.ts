import { Routes } from '@angular/router';

export const LOSSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./losses-page/losses-page.component').then((module) => module.LossesPageComponent),
    title: 'Pérdidas · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./loss-register-page/loss-register-page.component').then((module) => module.LossRegisterPageComponent),
    title: 'Registrar pérdida · El Rapidin',
  },
];
