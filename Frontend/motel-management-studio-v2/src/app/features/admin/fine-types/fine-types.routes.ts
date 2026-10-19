import { Routes } from '@angular/router';

export const FINE_TYPES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./fine-types-page/fine-types-page.component').then((module) => module.FineTypesPageComponent),
    title: 'Tipos de multa · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./fine-type-form-page/fine-type-form-page.component').then((module) => module.FineTypeFormPageComponent),
    title: 'Nuevo tipo de multa · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./fine-type-form-page/fine-type-form-page.component').then((module) => module.FineTypeFormPageComponent),
    title: 'Editar tipo de multa · El Rapidin',
  },
];
