import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { PageHeaderComponent } from '../page-header/page-header.component';
import { StepItem, StepperComponent } from '../stepper/stepper.component';

/**
 * Formulario como PÁGINA con pasos (RT-02, patrón Productos). Cero modales para capturar datos.
 *
 * <rms-form-page title="Nuevo producto" backLink="/backoffice/inventory/products" [steps]="steps"
 *   [current]="step()" [maxReached]="reached()" status="Borrador sin guardar" withAside (stepSelect)="goTo($event)">
 *   <rms-notice …/>                 → avisos bajo el stepper (atributo `notices` o el propio rms-notice)
 *   …contenido del paso…            → columna principal
 *   <aside aside>vista previa</aside>
 *   <ng-container footer>botones Anterior / Guardar</ng-container>
 * </rms-form-page>
 */
@Component({
  selector: 'rms-form-page',
  imports: [PageHeaderComponent, StepperComponent],
  template: `
    <rms-page-header [title]="title()" [subtitle]="subtitle()" [eyebrow]="eyebrow()" [backLink]="backLink()" [backLabel]="backLabel()">
      <div actions class="rms-form-page__header-actions"><ng-content select="[header-actions]" /></div>
    </rms-page-header>
    @if (steps().length > 1) {
      <rms-stepper [steps]="steps()" [current]="current()" [maxReached]="maxReached()" (stepSelect)="stepSelect.emit($event)" />
    }
    <div class="rms-form-page__notices"><ng-content select="rms-notice, [notices]" /></div>
    <div class="rms-form-page__layout" [class.has-aside]="withAside()">
      <section class="rms-form-page__main"><ng-content /></section>
      @if (withAside()) { <div class="rms-form-page__aside"><ng-content select="[aside]" /></div> }
    </div>
    <footer class="rms-form-page__footer">
      <span class="rms-form-page__status" aria-live="polite">@if (status()) { <i aria-hidden="true"></i>{{ status() }} }</span>
      <div class="rms-form-page__footer-actions"><ng-content select="[footer]" /></div>
    </footer>
  `,
  host: { class: 'rms-form-page', '[attr.aria-busy]': 'busy()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormPageComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly backLink = input<string | readonly unknown[] | null>(null);
  readonly backLabel = input('Volver al listado');
  readonly steps = input<readonly StepItem[]>([]);
  readonly current = input(0);
  readonly maxReached = input<number | null>(null);
  readonly status = input<string | null>(null);
  readonly busy = input(false);
  readonly withAside = input(false, { transform: booleanAttribute });
  readonly stepSelect = output<number>();
}
