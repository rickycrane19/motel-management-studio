import { Injectable, signal } from '@angular/core';

import { CazoIconName } from '../cazo-icon/cazo-icon.component';

export interface ConfirmOptions {
  readonly title: string;
  readonly message?: string;
  /** Dato destacado (nombre del producto, número de orden…). */
  readonly detail?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: 'primary' | 'danger' | 'warning';
  readonly icon?: CazoIconName;
}

export interface ConfirmRequest extends ConfirmOptions {
  readonly id: number;
}

/**
 * Diálogo de confirmación del sistema (RT-02): solo para confirmar acciones breves
 * (eliminar, cancelar, salir sin guardar). Nunca para capturar datos y nunca `window.confirm`.
 *
 *   if (await this.confirm.ask({ title: 'Eliminar producto', detail: p.name, tone: 'danger', confirmLabel: 'Eliminar' })) { … }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private sequence = 0;
  private resolver: ((accepted: boolean) => void) | null = null;
  private readonly state = signal<ConfirmRequest | null>(null);
  readonly current = this.state.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    this.settle(false);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.state.set({ ...options, id: ++this.sequence });
    });
  }

  settle(accepted: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.state.set(null);
    resolve?.(accepted);
  }
}
