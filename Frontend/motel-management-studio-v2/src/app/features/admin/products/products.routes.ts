import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./products-page/products-page.component').then((module) => module.ProductsPageComponent),
    title: 'Productos · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./product-form-page/product-form-page.component').then((module) => module.ProductFormPageComponent),
    title: 'Nuevo producto · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./product-form-page/product-form-page.component').then((module) => module.ProductFormPageComponent),
    title: 'Editar producto · El Rapidin',
  },
];
