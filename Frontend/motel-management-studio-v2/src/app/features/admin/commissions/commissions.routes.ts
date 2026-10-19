import { Routes } from '@angular/router';

export const COMMISSIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./commissions-page/commissions-page.component').then((module) => module.CommissionsPageComponent),
    title: 'Comisiones · El Rapidin',
  },
];
