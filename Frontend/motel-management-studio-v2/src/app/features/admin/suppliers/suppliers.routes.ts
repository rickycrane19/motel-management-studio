import { Routes } from '@angular/router';

export const SUPPLIERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./suppliers-page/suppliers-page.component').then((module) => module.SuppliersPageComponent),
    title: 'Proveedores · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./supplier-form-page/supplier-form-page.component').then((module) => module.SupplierFormPageComponent),
    title: 'Nuevo proveedor · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./supplier-form-page/supplier-form-page.component').then((module) => module.SupplierFormPageComponent),
    title: 'Editar proveedor · El Rapidin',
  },
];
