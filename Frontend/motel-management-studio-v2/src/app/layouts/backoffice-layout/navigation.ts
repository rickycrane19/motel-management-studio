import type { CazoIconName } from '../../shared/ui/cazo-icon/cazo-icon.component';

export interface NavItem {
  readonly route: string;
  readonly queryParams?: Record<string, string>;
  readonly label: string;
  readonly icon: CazoIconName;
  readonly groupId: string;
  readonly groupLabel: string;
  readonly featureId: string;
  readonly keywords?: string;
}

export function normalizeSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: CazoIconName;
  readonly headless?: boolean;
  readonly items: readonly NavItem[];
}

/**
 * Secciones del Back Office de El Rapidin.
 * Cada grupo lleva su propio ícono (rms-cazo-icon), como en el diseño rms.
 */
export const ALL_GROUPS: readonly NavGroup[] = [
  {
    id: 'service',
    label: 'Habitaciones y Tarifas',
    icon: 'bed',
    items: [
      { route: '/admin/rooms', label: 'Habitaciones', icon: 'bed', groupId: 'service', groupLabel: 'Habitaciones', featureId: 'service.rooms', keywords: 'habitaciones cuartos rooms pisos tipos limpieza mantenimiento' },
      { route: '/admin/reservations', label: 'Reservas', icon: 'calendar', groupId: 'service', groupLabel: 'Habitaciones', featureId: 'service.rooms', keywords: 'reservas reservaciones agenda llegadas clientes no show cancelar' },
      { route: '/admin/customers', label: 'Clientes', icon: 'user', groupId: 'service', groupLabel: 'Habitaciones', featureId: 'service.rooms', keywords: 'clientes huespedes contacto telefono correo documento cedula' },
      { route: '/admin/stay-types', label: 'Tarifas', icon: 'clock', groupId: 'service', groupLabel: 'Habitaciones', featureId: 'service.stay-types', keywords: 'tarifas precios estancias horas extensiones pernocte' },
      { route: '/admin/fine-types', label: 'Tipos de multa', icon: 'alert', groupId: 'service', groupLabel: 'Habitaciones', featureId: 'service.fine-types', keywords: 'multas danos fines catalogo sanciones' },
    ],
  },
  {
    id: 'minibar',
    label: 'Minibar',
    icon: 'package',
    items: [
      { route: '/admin/products', label: 'Productos y stock', icon: 'package', groupId: 'minibar', groupLabel: 'Minibar', featureId: 'inventory.products', keywords: 'productos stock minibar productos catalogo' },
      { route: '/admin/movements', label: 'Movimientos', icon: 'swap', groupId: 'minibar', groupLabel: 'Minibar', featureId: 'inventory.movements', keywords: 'movimientos inventario entradas salidas ajustes compras devoluciones' },
      { route: '/admin/purchases', label: 'Compras y dev. a proveedor', icon: 'receipt', groupId: 'minibar', groupLabel: 'Minibar', featureId: 'inventory.movements', keywords: 'compras proveedores devolucion a proveedor reposicion costo' },
      { route: '/admin/customer-returns', label: 'Devoluciones a cliente', icon: 'swap', groupId: 'minibar', groupLabel: 'Minibar', featureId: 'inventory.movements', keywords: 'devoluciones cliente refund reembolso producto' },
      { route: '/admin/suppliers', label: 'Proveedores', icon: 'truck', groupId: 'minibar', groupLabel: 'Minibar', featureId: 'inventory.products', keywords: 'proveedores supplier compras contacto ruc' },
    ],
  },
  {
    id: 'finance',
    label: 'Caja y Turnos',
    icon: 'cash',
    items: [
      { route: '/admin/cashbox', label: 'Sesión de caja', icon: 'cash', groupId: 'finance', groupLabel: 'Caja', featureId: 'finance.cashbox', keywords: 'caja turnos arqueo apertura cierre ajustes denominaciones' },
      { route: '/admin/cashbox/historial', label: 'Historial de caja', icon: 'clock', groupId: 'finance', groupLabel: 'Caja', featureId: 'finance.cashbox', keywords: 'historial turnos diferencias sobrantes faltantes cierres' },
      { route: '/admin/losses', label: 'Pérdidas', icon: 'alert', groupId: 'finance', groupLabel: 'Caja', featureId: 'finance.losses', keywords: 'perdidas mermas danos faltantes gastos' },
      { route: '/admin/reports', label: 'Reportes', icon: 'chart', groupId: 'finance', groupLabel: 'Caja', featureId: 'finance.reports', keywords: 'reportes ganancias perdidas ventas servicios productos inventario nomina resumen' },
      { route: '/admin/cajeros', label: 'Rendimiento por cajero', icon: 'users', groupId: 'finance', groupLabel: 'Caja', featureId: 'finance.reports', keywords: 'cajeros turnos propinas comisiones rendimiento usuario ventas' },
    ],
  },
  {
    id: 'people',
    label: 'Personas y Accesos',
    icon: 'users',
    items: [
      { route: '/admin/employees', label: 'Empleados', icon: 'users', groupId: 'people', groupLabel: 'Personas', featureId: 'hr.employees', keywords: 'empleados personal pagos puestos tarifas' },
      { route: '/admin/contracts', label: 'Contratos y salarios', icon: 'wallet', groupId: 'people', groupLabel: 'Personas', featureId: 'hr.employees', keywords: 'contratos salarios nomina mensual turnos extra pagos' },
      { route: '/admin/commissions', label: 'Comisiones', icon: 'percent', groupId: 'people', groupLabel: 'Personas', featureId: 'hr.employees', keywords: 'comisiones reglas tramos rangos porcentaje ventas propinas puestos' },
      { route: '/admin/users', label: 'Usuarios', icon: 'shield', groupId: 'people', groupLabel: 'Personas', featureId: 'security.users', keywords: 'usuarios accesos roles perfiles cuentas' },
    ],
  },
];

export function visibleNavGroups(
  hasPermission: (permission: string) => boolean,
  _options: { hasLocation: boolean },
): readonly NavGroup[] {
  return ALL_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(item.featureId)),
    }))
    .filter((group) => group.items.length > 0);
}
