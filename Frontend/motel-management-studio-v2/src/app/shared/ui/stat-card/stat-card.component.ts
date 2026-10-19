import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CazoIconComponent, CazoIconName } from '../cazo-icon/cazo-icon.component';

export type StatCardTone = 'soft' | 'brand' | 'ink' | 'success' | 'warning' | 'danger';

/** Tarjeta de indicador. `loading` muestra skeleton; `value` nulo muestra «—» (nunca un dato inventado). */
@Component({
  selector: 'rms-stat-card',
  imports: [CazoIconComponent],
  template: `
    @if (icon(); as name) {
      <span class="rms-stat__icon" aria-hidden="true"><rms-cazo-icon [name]="name" [size]="22" /></span>
    }
    <span class="rms-stat__body">
      <small>{{ label() }}</small>
      @if (loading()) {
        <span class="rms-skeleton rms-skeleton--value" aria-hidden="true"></span>
        <span class="rms-sr-only">Cargando {{ label() }}</span>
      } @else {
        <strong>{{ display() }}</strong>
      }
      @if (hint()) { <em>{{ hint() }}</em> }
      <ng-content />
    </span>
  `,
  host: { '[class]': 'hostClass()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number | null | undefined>(null);
  readonly hint = input<string | null>(null);
  readonly icon = input<CazoIconName | null>(null);
  readonly tone = input<StatCardTone>('soft');
  readonly loading = input(false);

  protected readonly display = computed(() => {
    const value = this.value();
    return value === null || value === undefined || value === '' ? '—' : String(value);
  });
  protected readonly hostClass = computed(() => `rms-stat rms-stat--${this.tone()}`);
}
