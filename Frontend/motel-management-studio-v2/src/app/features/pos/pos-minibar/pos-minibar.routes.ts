import { Routes } from '@angular/router';

/** Rutas del carrito de productos del minibar dentro del POS (Montaje en /pos/minibar). */
export const POS_MINIBAR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pos-minibar-page.component').then((module) => module.PosMinibarPageComponent),
    title: 'Minibar POS · El Rapidin',
  },
];
