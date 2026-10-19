import { Routes } from '@angular/router';

export const POS_ROOMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pos-rooms-page.component').then((module) => module.PosRoomsPageComponent),
    title: 'Servicio al cuarto · El Rapidin',
  },
];
