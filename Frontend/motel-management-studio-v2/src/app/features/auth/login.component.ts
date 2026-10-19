import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-brand">
          <svg aria-hidden="true" viewBox="0 0 58 48" class="login-logo">
            <path d="M10 28h38c0 9-8 15-19 15S10 37 10 28Z" fill="currentColor"/>
            <path d="M17 23c-5-5 4-8 0-14M29 23c-5-5 4-8 0-14M41 23c-5-5 4-8 0-14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <h1>EL RAPIDIN</h1>
          <p>El Rapidin</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="rms-field">
            <label class="rms-field__label" for="username">Usuario</label>
            <div class="rms-field__control">
              <input
                id="username"
                type="text"
                class="rms-input"
                [(ngModel)]="username"
                name="username"
                placeholder="Ingrese su usuario"
                required
                autocomplete="username"
              />
            </div>
          </div>

          <div class="rms-field">
            <label class="rms-field__label" for="password">Contraseña</label>
            <div class="rms-field__control">
              <input
                id="password"
                type="password"
                class="rms-input"
                [(ngModel)]="password"
                name="password"
                placeholder="Ingrese su contraseña"
                required
                autocomplete="current-password"
              />
            </div>
          </div>

          @if (errorMessage()) {
            <div class="rms-notice rms-notice--danger" role="alert">
              <span class="rms-notice__icon">!</span>
              <div class="rms-notice__copy">
                <strong>Error de autenticación</strong>
                <span>{{ errorMessage() }}</span>
              </div>
            </div>
          }

          <button type="submit" class="rms-btn rms-btn--primary rms-btn--block" [disabled]="isLoading()">
            @if (isLoading()) {
              <span class="rms-spinner"></span>
              Ingresando...
            } @else {
              Ingresar
            }
          </button>
        </form>

        <div class="login-footer">
          <p>Credenciales de Acceso Rápido:</p>
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 6px;">
            <button type="button" class="rms-btn rms-btn--ghost rms-btn--sm" (click)="username = 'admin'; password = '123456'">
              <span aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              Admin (123456)
            </button>
            <button type="button" class="rms-btn rms-btn--ghost rms-btn--sm" (click)="username = 'recepcion'; password = '123456'">
              <span aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
              Recepción (123456)
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 20px;
      background: var(--motel-bg);
    }

    .login-card {
      width: min(420px, 100%);
      padding: 32px 28px 24px;
      border: 1px solid var(--motel-line);
      border-radius: var(--motel-radius-xl);
      background: var(--motel-surface);
      box-shadow: var(--motel-shadow-raised);
      animation: rms-fade-up .28s var(--motel-ease) both;
    }

    .login-brand {
      display: grid;
      justify-items: center;
      gap: 6px;
      margin-bottom: 24px;
      text-align: center;
    }

    .login-logo {
      width: 56px;
      height: 56px;
      color: var(--motel-brand);
    }

    .login-brand h1 {
      margin: 0;
      font: 650 28px/1.1 var(--motel-font-display);
      letter-spacing: .02em;
    }

    .login-brand p {
      margin: 0;
      color: var(--motel-muted);
      font-size: 14px;
    }

    .login-form {
      display: grid;
      gap: 16px;
    }

    .login-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--motel-line);
      text-align: center;
    }

    .login-footer p {
      margin: 0;
      color: var(--motel-muted);
      font-size: 12px;
    }
  `]
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  isLoading = signal(false);
  errorMessage = signal('');

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage.set('Por favor ingrese usuario y contraseña');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/pos']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.detail || 'Error al iniciar sesión. Verifique sus credenciales.'
        );
      }
    });
  }
}
