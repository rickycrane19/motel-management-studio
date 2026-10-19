import { Routes } from '@angular/router';

export const STAY_TYPES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./stay-types-page/stay-types-page.component').then((module) => module.StayTypesPageComponent),
    title: 'Tarifas de estancia · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./stay-type-form-page/stay-type-form-page.component').then((module) => module.StayTypeFormPageComponent),
    title: 'Nueva tarifa · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./stay-type-form-page/stay-type-form-page.component').then((module) => module.StayTypeFormPageComponent),
    title: 'Editar tarifa · El Rapidin',
  },
];
