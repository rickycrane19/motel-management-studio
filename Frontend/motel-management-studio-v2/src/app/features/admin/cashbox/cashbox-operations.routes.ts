import { Routes } from '@angular/router';

export const CASHBOX_OPERATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./cashbox-operations-page.component').then(
        (module) => module.CashboxOperationsPageComponent,
      ),
    title: 'Monitor de caja · El Rapidin',
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./cashbox-history-page/cashbox-history-page.component').then(
        (module) => module.CashboxHistoryPageComponent,
      ),
    title: 'Historial de caja · El Rapidin',
  },
];
