import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly message?: string;
}

/**
 * Avisos breves que desaparecen solos (4,5 s; los errores 8 s). Mensajes para personas:
 * qué pasó y, si aplica, qué hacer. `toast.success('Producto creado', 'Ya aparece en el POS.')`.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private sequence = 0;
  private readonly items = signal<readonly Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  success(title: string, message?: string): void { this.show('success', title, message); }
  info(title: string, message?: string): void { this.show('info', title, message); }
  warning(title: string, message?: string): void { this.show('warning', title, message); }
  error(title: string, message?: string): void { this.show('danger', title, message); }

  dismiss(id: number): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  private show(tone: ToastTone, title: string, message?: string): void {
    const toast: Toast = { id: ++this.sequence, tone, title, message };
    this.items.update((items) => [...items.slice(-3), toast]);
    setTimeout(() => this.dismiss(toast.id), tone === 'danger' ? 8000 : 4500);
  }
}
