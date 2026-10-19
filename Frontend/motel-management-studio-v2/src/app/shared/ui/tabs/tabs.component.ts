import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model } from '@angular/core';

import { CazoIconComponent, CazoIconName } from '../cazo-icon/cazo-icon.component';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: CazoIconName;
  readonly count?: number | null;
  readonly disabled?: boolean;
}

/**
 * Pestañas accesibles (flechas, Inicio/Fin). El contenido lo pinta la vista con `@switch`:
 * `<rms-tabs [tabs]="tabs" [(active)]="tab" />`. Usa `idPrefix` para enlazar `aria-labelledby`.
 */
@Component({
  selector: 'rms-tabs',
  imports: [CazoIconComponent],
  template: `
    <div class="rms-tabs__list" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.id; let index = $index) {
        <button type="button" role="tab" class="rms-tabs__tab" [id]="idPrefix() + '-' + tab.id"
          [attr.aria-selected]="tab.id === active()" [attr.aria-controls]="idPrefix() + '-panel'"
          [tabIndex]="tab.id === active() ? 0 : -1" [disabled]="tab.disabled ?? false"
          (click)="select(tab)" (keydown)="onKeydown($event, index)">
          @if (tab.icon) { <rms-cazo-icon [name]="tab.icon" [size]="17" /> }
          <span>{{ tab.label }}</span>
          @if (tab.count !== undefined && tab.count !== null) { <b>{{ tab.count }}</b> }
        </button>
      }
    </div>
  `,
  host: { class: 'rms-tabs' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly tabs = input.required<readonly TabItem[]>();
  readonly active = model.required<string>();
  readonly ariaLabel = input('Secciones');
  readonly idPrefix = input('rms-tab');

  protected select(tab: TabItem): void {
    if (!tab.disabled) this.active.set(tab.id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const enabled = this.tabs().map((tab, position) => ({ tab, position })).filter(({ tab }) => !tab.disabled);
    const current = enabled.findIndex(({ position }) => position === index);
    let next = -1;
    if (event.key === 'ArrowRight') next = (current + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = enabled[next];
    this.active.set(target.tab.id);
    this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target.position]?.focus();
  }
}
