import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';

import { CazoIconComponent, CazoIconName } from '../cazo-icon/cazo-icon.component';
import { ConfirmDialogService } from './confirm-dialog.service';

/** Monta una sola vez en la raíz (`app.html`). Usa <dialog> nativo: foco atrapado, Esc y capa superior. */
@Component({
  selector: 'rms-dialog-host',
  imports: [CazoIconComponent],
  template: `
    <dialog #dialog class="rms-dialog" [attr.aria-labelledby]="'rms-dialog-title'" (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      @if (request(); as current) {
        <div class="rms-dialog__body" [class]="'rms-dialog__body rms-dialog__body--' + (current.tone ?? 'primary')">
          <span class="rms-dialog__icon" aria-hidden="true"><rms-cazo-icon [name]="icon()" [size]="22" /></span>
          <h2 id="rms-dialog-title">{{ current.title }}</h2>
          @if (current.message) { <p>{{ current.message }}</p> }
          @if (current.detail) { <strong class="rms-dialog__detail">{{ current.detail }}</strong> }
          <div class="rms-dialog__actions">
            <button type="button" class="rms-btn rms-btn--secondary" autofocus (click)="service.settle(false)">{{ current.cancelLabel ?? 'Cancelar' }}</button>
            <button type="button" class="rms-btn" [class.rms-btn--danger]="current.tone === 'danger'" [class.rms-btn--primary]="current.tone !== 'danger'"
              (click)="service.settle(true)">{{ current.confirmLabel ?? 'Confirmar' }}</button>
          </div>
        </div>
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogHostComponent {
  protected readonly service = inject(ConfirmDialogService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly request = this.service.current;
  protected readonly icon = computed<CazoIconName>(() => {
    const current = this.request();
    return current?.icon ?? (current?.tone === 'danger' ? 'trash' : current?.tone === 'warning' ? 'alert' : 'info');
  });

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.request() && !element.open) element.showModal();
      else if (!this.request() && element.open) element.close();
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.service.settle(false);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.service.settle(false);
  }
}
