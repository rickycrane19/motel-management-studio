import { Routes } from '@angular/router';

export const CONTRACTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./contracts-page/contracts-page.component').then((module) => module.ContractsPageComponent),
    title: 'Contratos · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./contract-form-page/contract-form-page.component').then((module) => module.ContractFormPageComponent),
    title: 'Nuevo contrato · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./contract-form-page/contract-form-page.component').then((module) => module.ContractFormPageComponent),
    title: 'Editar contrato · El Rapidin',
  },
];
