import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CazoIconComponent, CazoIconName } from '../cazo-icon/cazo-icon.component';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger' | 'offline';

const ICONS: Record<NoticeTone, CazoIconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
  offline: 'wifi-off',
};

/** Aviso en línea: qué pasó y qué hacer. Acciones opcionales con `<button actions>`. */
@Component({
  selector: 'rms-notice',
  imports: [CazoIconComponent],
  template: `
    <span class="rms-notice__icon" aria-hidden="true"><rms-cazo-icon [name]="iconName()" [size]="18" /></span>
    <div class="rms-notice__copy">
      @if (title()) { <strong>{{ title() }}</strong> }
      <span><ng-content /></span>
    </div>
    <div class="rms-notice__actions"><ng-content select="[actions]" /></div>
    @if (dismissible()) {
      <button type="button" class="rms-notice__close" (click)="dismissed.emit()" aria-label="Cerrar aviso">
        <rms-cazo-icon name="close" [size]="16" />
      </button>
    }
  `,
  host: {
    '[class]': "'rms-notice rms-notice--' + tone()",
    '[attr.role]': "tone() === 'danger' ? 'alert' : 'status'",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeComponent {
  readonly tone = input<NoticeTone>('info');
  readonly title = input<string | null>(null);
  readonly icon = input<CazoIconName | null>(null);
  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly dismissed = output<void>();

  protected readonly iconName = computed(() => this.icon() ?? ICONS[this.tone()]);
}
