import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

/**
 * Panel lateral para CONSULTAR detalle o lanzar acciones rápidas sin perder el listado.
 * No es un formulario: capturar datos va en una página con pasos (`rms-form-page`).
 * `<rms-drawer [open]="!!selected()" title="Orden #120" (closed)="selected.set(null)">…<div footer>…</div></rms-drawer>`
 */
@Component({
  selector: 'rms-drawer',
  imports: [CazoIconComponent],
  template: `
    <dialog #dialog class="rms-drawer" [attr.aria-label]="title()" (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      <header class="rms-drawer__header">
        <div>
          @if (eyebrow()) { <span class="rms-eyebrow">{{ eyebrow() }}</span> }
          <h2>{{ title() }}</h2>
          @if (subtitle()) { <p>{{ subtitle() }}</p> }
        </div>
        <button type="button" class="rms-icon-btn" (click)="closed.emit()" aria-label="Cerrar panel"><rms-cazo-icon name="close" [size]="18" /></button>
      </header>
      <div class="rms-drawer__body"><ng-content /></div>
      <footer class="rms-drawer__footer"><ng-content select="[footer]" /></footer>
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly closed = output<void>();

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) element.showModal();
      else if (!this.open() && element.open) element.close();
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.closed.emit();
  }
}
