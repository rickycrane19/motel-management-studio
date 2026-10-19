import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then(
        (module) => module.LoginComponent,
      ),
    title: 'Iniciar sesión · El Rapidin',
  },
  {
    path: 'pos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/pos-layout/pos-layout.component').then((module) => module.PosLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'rooms',
      },
      {
        path: 'minibar',
        loadChildren: () =>
          import('./features/pos/pos-minibar/pos-minibar.routes').then(
            (module) => module.POS_MINIBAR_ROUTES,
          ),
        title: 'Minibar POS · El Rapidin',
      },
      {
        path: 'rooms',
        loadChildren: () =>
          import('./features/pos/pos-rooms/pos-rooms.routes').then(
            (module) => module.POS_ROOMS_ROUTES,
          ),
        title: 'Servicio al cuarto · El Rapidin',
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/backoffice-layout/backoffice-layout.component').then(
        (module) => module.BackofficeLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'products' },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/admin/products/products.routes').then((module) => module.PRODUCTS_ROUTES),
      },
      {
        path: 'cashbox',
        loadChildren: () =>
          import('./features/admin/cashbox/cashbox-operations.routes').then(
            (module) => module.CASHBOX_OPERATIONS_ROUTES,
          ),
        title: 'Caja · El Rapidin',
      },
      {
        path: 'reservations',
        loadChildren: () =>
          import('./features/admin/reservations/reservations.routes').then((module) => module.RESERVATIONS_ROUTES),
        title: 'Reservaciones · El Rapidin',
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/admin/customers/customers.routes').then((module) => module.CUSTOMERS_ROUTES),
        title: 'Clientes · El Rapidin',
      },
      {
        path: 'rooms',
        loadChildren: () =>
          import('./features/admin/rooms/rooms.routes').then((module) => module.ROOMS_ROUTES),
        title: 'Habitaciones · El Rapidin',
      },
      {
        path: 'stay-types',
        loadChildren: () =>
          import('./features/admin/stay-types/stay-types.routes').then((module) => module.STAY_TYPES_ROUTES),
        title: 'Tarifas · El Rapidin',
      },
      {
        path: 'fine-types',
        loadChildren: () =>
          import('./features/admin/fine-types/fine-types.routes').then((module) => module.FINE_TYPES_ROUTES),
        title: 'Tipos de multa · El Rapidin',
      },
      {
        path: 'movements',
        loadChildren: () =>
          import('./features/admin/movements/movements.routes').then((module) => module.MOVEMENTS_ROUTES),
        title: 'Movimientos de inventario · El Rapidin',
      },
      {
        path: 'employees',
        loadChildren: () =>
          import('./features/admin/employees/employees.routes').then((module) => module.EMPLOYEES_ROUTES),
        title: 'Empleados · El Rapidin',
      },
      {
        path: 'users',
        loadChildren: () =>
          import('./features/admin/users/users.routes').then((module) => module.USERS_ROUTES),
        title: 'Usuarios · El Rapidin',
      },
      {
        path: 'purchases',
        loadChildren: () =>
          import('./features/admin/purchases/purchases.routes').then((module) => module.PURCHASES_ROUTES),
        title: 'Compras y devoluciones · El Rapidin',
      },
      {
        path: 'customer-returns',
        loadChildren: () =>
          import('./features/admin/customer-returns/customer-returns.routes').then(
            (module) => module.CUSTOMER_RETURNS_ROUTES,
          ),
        title: 'Devoluciones a cliente · El Rapidin',
      },
      {
        path: 'suppliers',
        loadChildren: () =>
          import('./features/admin/suppliers/suppliers.routes').then((module) => module.SUPPLIERS_ROUTES),
        title: 'Proveedores · El Rapidin',
      },
      {
        path: 'contracts',
        loadChildren: () =>
          import('./features/admin/contracts/contracts.routes').then((module) => module.CONTRACTS_ROUTES),
        title: 'Contratos · El Rapidin',
      },
      {
        path: 'commissions',
        loadChildren: () =>
          import('./features/admin/commissions/commissions.routes').then((module) => module.COMMISSIONS_ROUTES),
        title: 'Comisiones · El Rapidin',
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/admin/reports/reports.routes').then((module) => module.REPORTS_ROUTES),
        title: 'Reportes financieros · El Rapidin',
      },
      {
        path: 'losses',
        loadChildren: () =>
          import('./features/admin/losses/losses.routes').then((module) => module.LOSSES_ROUTES),
        title: 'Pérdidas · El Rapidin',
      },
      {
        path: 'cajeros',
        loadChildren: () =>
          import('./features/admin/cashier-report/cashier-report.routes').then(
            (module) => module.CASHIER_REPORT_ROUTES,
          ),
        title: 'Rendimiento por cajero · El Rapidin',
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'pos' },
  { path: '**', redirectTo: 'pos' },
];
