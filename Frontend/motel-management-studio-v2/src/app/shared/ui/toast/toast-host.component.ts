import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';
import { ToastService } from './toast.service';

/** Monta una sola vez en la raíz (`app.html`). */
@Component({
  selector: 'rms-toast-host',
  imports: [CazoIconComponent],
  template: `
    <section class="rms-toasts" aria-live="polite" aria-label="Avisos">
      @for (toast of service.toasts(); track toast.id) {
        <article class="rms-toast" [class]="'rms-toast rms-toast--' + toast.tone" [attr.role]="toast.tone === 'danger' ? 'alert' : 'status'">
          <span class="rms-toast__icon" aria-hidden="true">
            <rms-cazo-icon [name]="toast.tone === 'success' ? 'check' : toast.tone === 'info' ? 'info' : 'alert'" [size]="18" />
          </span>
          <div><strong>{{ toast.title }}</strong>@if (toast.message) { <p>{{ toast.message }}</p> }</div>
          <button type="button" (click)="service.dismiss(toast.id)" aria-label="Cerrar aviso"><rms-cazo-icon name="close" [size]="15" /></button>
        </article>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHostComponent {
  protected readonly service = inject(ToastService);
}
