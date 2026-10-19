import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CazoIconComponent, CazoIconName } from '../cazo-icon/cazo-icon.component';

export type EmptyStateKind = 'empty' | 'search' | 'error' | 'offline' | 'forbidden';

const ICONS: Record<EmptyStateKind, CazoIconName> = {
  empty: 'package',
  search: 'search',
  error: 'alert',
  offline: 'wifi-off',
  forbidden: 'lock',
};

/**
 * Estado vacío / error / sin conexión / sin permiso. Siempre explica la causa y ofrece salida:
 * `<rms-empty-state kind="error" title="…" description="…"><button class="rms-btn …">Reintentar</button></rms-empty-state>`.
 */
@Component({
  selector: 'rms-empty-state',
  imports: [CazoIconComponent],
  template: `
    <span class="rms-empty__icon" aria-hidden="true"><rms-cazo-icon [name]="iconName()" [size]="24" /></span>
    <strong class="rms-empty__title">{{ title() }}</strong>
    @if (description()) { <p class="rms-empty__description">{{ description() }}</p> }
    <div class="rms-empty__actions"><ng-content /></div>
  `,
  host: {
    '[class]': "'rms-empty rms-empty--' + kind() + (compact() ? ' rms-empty--compact' : '')",
    '[attr.role]': "kind() === 'error' ? 'alert' : 'status'",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly kind = input<EmptyStateKind>('empty');
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly icon = input<CazoIconName | null>(null);
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly iconName = computed(() => this.icon() ?? ICONS[this.kind()]);
}
