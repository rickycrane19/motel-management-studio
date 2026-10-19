import { Routes } from '@angular/router';

export const CUSTOMER_RETURNS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customer-returns-page/customer-returns-page.component').then((module) => module.CustomerReturnsPageComponent),
    title: 'Devoluciones de clientes · El Rapidin',
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./customer-return-form-page/customer-return-form-page.component').then((module) => module.CustomerReturnFormPageComponent),
    title: 'Registrar devolución de cliente · El Rapidin',
  },
];
