import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tarjeta de sección (formularios, tableros, detalle). Superficie crema con borde; nunca blanca.
 * Acciones en la cabecera: `<button actions …>`; pie: `<div footer>…</div>`.
 */
@Component({
  selector: 'rms-panel',
  template: `
    @if (title() || eyebrow()) {
      <header class="rms-panel__header">
        <div>
          @if (eyebrow()) { <span class="rms-eyebrow">{{ eyebrow() }}</span> }
          @if (title()) { <h2>{{ title() }}</h2> }
          @if (subtitle()) { <p>{{ subtitle() }}</p> }
        </div>
        <div class="rms-panel__actions"><ng-content select="[actions]" /></div>
      </header>
    }
    <div class="rms-panel__body" [class.rms-panel__body--flush]="flush()"><ng-content /></div>
    <ng-content select="[footer]" />
  `,
  host: { class: 'rms-panel', '[class.rms-panel--raised]': 'raised()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelComponent {
  readonly title = input<string | null>(null);
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  /** Sin relleno interno (tablas a sangre). */
  readonly flush = input(false, { transform: booleanAttribute });
  /** Crema más oscuro para destacar (resúmenes, vista previa). */
  readonly raised = input(false, { transform: booleanAttribute });
}
