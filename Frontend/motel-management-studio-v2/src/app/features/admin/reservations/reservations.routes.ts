import { Routes } from '@angular/router';

export const RESERVATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reservations-page/reservations-page.component').then((module) => module.ReservationsPageComponent),
    title: 'Reservaciones · El Rapidin',
  },
];
