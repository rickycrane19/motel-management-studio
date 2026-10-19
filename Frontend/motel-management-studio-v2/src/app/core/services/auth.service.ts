import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserSession } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly sessionKey = 'motel_session';
  private sessionSignal = signal<UserSession | null>(this.loadSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly currentUser = computed(() => this.sessionSignal()?.user ?? null);
  readonly token = computed(() => this.sessionSignal()?.token ?? null);

  private readonly permissions = computed<Set<string>>(() => {
    const role = this.sessionSignal()?.user.role?.toUpperCase() ?? '';
    // Admin has all permissions
    if (role === 'ADMIN' || role === 'SUPERADMIN') {
      return new Set(['service.rooms', 'service.stay-types', 'service.fine-types', 'inventory.products', 'inventory.movements', 'finance.cashbox', 'finance.sessions', 'finance.reports', 'finance.losses', 'hr.employees', 'hr.payments', 'security.users']);
    }
    // Reception has service and cash permissions
    if (role === 'RECEPTION' || role === 'RECEPTIONIST' || role === 'CASHIER') {
      return new Set(['service.rooms', 'service.stay-types', 'finance.cashbox', 'finance.losses', 'inventory.movements']);
    }
    return new Set();
  });

  hasPermission(permission: string): boolean {
    return this.permissions().has(permission);
  }

  login(username: string, password: string): Observable<UserSession> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/login`, { username, password }).pipe(
      map(res => {
        const data = res.value || res;
        const session: UserSession = {
          token: data.accessToken,
          user: {
            userId: data.user.userId,
            tenantId: data.user.tenantId,
            tenantName: data.user.tenantName,
            locationId: data.user.locationId,
            username: data.user.username,
            fullName: data.user.fullName,
            role: data.user.role,
            timeZone: data.user.timeZone,
            currencyCode: data.user.currencyCode || 'NIO'
          }
        };
        this.setSession(session);
        return session;
      })
    );
  }

  setSession(session: UserSession): void {
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  logout(): void {
    localStorage.removeItem(this.sessionKey);
    this.sessionSignal.set(null);
  }

  private loadSession(): UserSession | null {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}
