import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

/**
 * Encabezado estándar de página: miga/eyebrow, título, descripción para personas y acciones.
 * Acciones: `<button actions class="rms-btn rms-btn--primary">…</button>`.
 * Datos extra bajo el título: `<div meta>…</div>`.
 */
@Component({
  selector: 'rms-page-header',
  imports: [RouterLink, CazoIconComponent],
  template: `
    @if (backLink(); as link) {
      <a class="rms-page-header__back" [routerLink]="link">
        <rms-cazo-icon name="arrow-left" [size]="16" /><span>{{ backLabel() }}</span>
      </a>
    }
    <div class="rms-page-header__row">
      <div class="rms-page-header__copy">
        @if (eyebrow()) { <span class="rms-eyebrow">{{ eyebrow() }}</span> }
        <h1>{{ title() }}</h1>
        @if (subtitle()) { <p>{{ subtitle() }}</p> }
        <ng-content select="[meta]" />
      </div>
      <div class="rms-page-header__actions"><ng-content select="[actions]" /></div>
    </div>
  `,
  host: { class: 'rms-page-header' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly backLink = input<string | readonly unknown[] | null>(null);
  readonly backLabel = input('Volver');
}
