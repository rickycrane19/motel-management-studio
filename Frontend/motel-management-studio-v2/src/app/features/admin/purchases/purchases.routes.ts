import { Routes } from '@angular/router';

export const PURCHASES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./purchases-page/purchases-page.component').then((module) => module.PurchasesPageComponent),
    title: 'Compras y devoluciones a proveedor · El Rapidin',
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./purchase-form-page/purchase-form-page.component').then((module) => module.PurchaseFormPageComponent),
    title: 'Registrar compra o devolución · El Rapidin',
  },
];
