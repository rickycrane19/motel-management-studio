import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reports-page.component').then(
        (module) => module.ReportsPageComponent,
      ),
    title: 'Reportes financieros · El Rapidin',
  },
];
