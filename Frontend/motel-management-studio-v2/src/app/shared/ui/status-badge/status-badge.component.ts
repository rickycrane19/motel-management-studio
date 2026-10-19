import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'brand' | 'ink' | 'success' | 'warning' | 'danger' | 'info';

/** Insignia de estado. El texto siempre acompaña al color: `<rms-status-badge tone="success">Activo</rms-status-badge>`. */
@Component({
  selector: 'rms-status-badge',
  template: `@if (dot()) { <i aria-hidden="true"></i> }<ng-content />`,
  host: { '[class]': "'rms-badge rms-badge--' + tone()" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input(true);
}
