import { Injectable, computed, inject } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { UserSession } from '../models/models';

/**
 * Claves rms → claves del motel: si la vista pide «finance:view-cashbox»,
 * se acepta cualquier permiso de caja del motel.
 */
const PERMISSION_ALTERNATIVES: Record<string, readonly string[]> = {
  finance: ['finance.cashbox', 'finance.sessions', 'finance.reports', 'finance.losses'],
  'finance:view-cashbox': ['finance.cashbox', 'finance.sessions', 'finance.reports'],
  'finance:manage-cashbox': ['finance.sessions', 'finance.cashbox', 'finance.losses'],
  'finance:view-reports': ['finance.reports', 'finance.cashbox'],
  'finance.reports': ['finance.reports', 'finance.cashbox'],
  'finance.losses': ['finance.losses', 'finance.cashbox'],
  'inventory:view': ['inventory.products', 'inventory.movements'],
  'inventory:create': ['inventory.products', 'inventory.movements'],
  'inventory:update': ['inventory.products'],
  'inventory:delete': ['inventory.products'],
  'inventory:movements': ['inventory.movements'],
  service: ['service.rooms', 'service.stay-types', 'service.fine-types'],
  'service:view': ['service.rooms'],
  'service:manage': ['service.rooms'],
  'service.stay-types': ['service.stay-types'],
  'service.fine-types': ['service.fine-types'],
  hr: ['hr.employees', 'hr.payments'],
  'hr:view': ['hr.employees'],
  'hr:manage': ['hr.employees', 'hr.payments'],
  'hr.employees': ['hr.employees'],
  security: ['security.users'],
  'security:view': ['security.users'],
  'security.users': ['security.users'],
};

/**
 * Store de sesión compatible con las vistas del diseño rms (restaurant v2):
 * expone `session()` con la forma `tenant`/`user` y `hasPermission(clave)`.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly auth = inject(AuthService);

  readonly session = computed<RestaurantsSessionShape | null>(() => {
    const current = this.auth.session();
    if (!current) return null;
    return this.toShape(current);
  });

  hasPermission(permission: string): boolean {
    // Las vistas rms piden claves tipo «inventory:update» / «finance:view-cashbox»;
    // el motel usa claves por módulo («inventory.products», «finance.sessions»…).
    const direct = this.auth.hasPermission(permission);
    if (direct) return true;
    const role = this.auth.currentUser()?.role?.toUpperCase() ?? '';
    if (role === 'ADMIN' || role === 'SUPERADMIN') return true;
    const alternatives = PERMISSION_ALTERNATIVES[permission]
      ?? PERMISSION_ALTERNATIVES[permission.split(':')[0]];
    return (alternatives ?? []).some((candidate) => this.auth.hasPermission(candidate));
  }

  private toShape(session: UserSession): RestaurantsSessionShape {
    return {
      tenant: {
        tenantId: session.user.tenantId,
        locationId: session.user.locationId ?? '',
        timeZone: session.user.timeZone || 'America/Managua',
        currencyCode: session.user.currencyCode || 'NIO',
      },
      user: {
        userId: session.user.userId,
        username: session.user.username,
        fullName: session.user.fullName,
        role: session.user.role,
      },
    };
  }
}

export interface RestaurantsSessionShape {
  tenant: {
    tenantId: string;
    locationId: string;
    timeZone: string;
    currencyCode: string;
  };
  user: {
    userId: number;
    username: string;
    fullName: string;
    role: string;
  };
}
