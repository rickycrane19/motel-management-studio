import { Routes } from '@angular/router';

export const ROOMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./rooms-page/rooms-page.component').then((module) => module.RoomsPageComponent),
    title: 'Habitaciones · El Rapidin',
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./room-form-page/room-form-page.component').then((module) => module.RoomFormPageComponent),
    title: 'Nueva habitación · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./room-form-page/room-form-page.component').then((module) => module.RoomFormPageComponent),
    title: 'Editar habitación · El Rapidin',
  },
];
