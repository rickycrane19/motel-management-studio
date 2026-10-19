import { Routes } from '@angular/router';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./employees-page/employees-page.component').then((module) => module.EmployeesPageComponent),
    title: 'Empleados · El Rapidin',
  },
  {
    path: 'contratos',
    loadChildren: () =>
      import('../contracts/contracts.routes').then((module) => module.CONTRACTS_ROUTES),
    title: 'Contratos · El Rapidin',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./employee-form-page/employee-form-page.component').then((module) => module.EmployeeFormPageComponent),
    title: 'Nuevo empleado · El Rapidin',
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./employee-form-page/employee-form-page.component').then((module) => module.EmployeeFormPageComponent),
    title: 'Editar empleado · El Rapidin',
  },
];
