import { Routes } from '@angular/router';

export const MOVEMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./movements-page/movements-page.component').then((module) => module.MovementsPageComponent),
    title: 'Movimientos de inventario · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./movement-form-page/movement-form-page.component').then((module) => module.MovementFormPageComponent),
    title: 'Registrar movimiento · El Rapidin',
  },
];
