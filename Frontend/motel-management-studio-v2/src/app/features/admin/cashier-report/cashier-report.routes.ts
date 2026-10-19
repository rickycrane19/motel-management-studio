import { Routes } from '@angular/router';

export const CASHIER_REPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./cashier-report-page.component').then(
        (module) => module.CashierReportPageComponent,
      ),
    title: 'Rendimiento por cajero · El Rapidin',
  },
];
