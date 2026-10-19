import { Routes } from '@angular/router';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customers-page/customers-page.component').then((module) => module.CustomersPageComponent),
    title: 'Clientes · El Rapidin',
  },
];
