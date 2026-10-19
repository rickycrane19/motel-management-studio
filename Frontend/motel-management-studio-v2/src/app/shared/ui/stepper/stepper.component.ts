import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';

export interface StepItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly optional?: boolean;
  /** Marca el paso con error de validación. */
  readonly invalid?: boolean;
}

/**
 * Indicador de pasos con barra de progreso. `current` es 0-based; se puede volver a cualquier paso
 * ya visitado (`maxReached`) y nunca saltar hacia adelante sin validar.
 */
@Component({
  selector: 'rms-stepper',
  imports: [CazoIconComponent],
  template: `
    <div class="rms-stepper__progress" aria-hidden="true"><span [style.width.%]="progress()"></span></div>
    <ol class="rms-stepper__list">
      @for (step of steps(); track step.id; let index = $index) {
        <li class="rms-stepper__item" [class.is-active]="index === current()" [class.is-done]="index < current()" [class.is-visited]="index <= reached()"
          [class.is-invalid]="step.invalid">
          <button type="button" [disabled]="index > reached()" [attr.aria-current]="index === current() ? 'step' : null"
            (click)="select(index)">
            <span class="rms-stepper__marker">
              @if (step.invalid) { <rms-cazo-icon name="alert" [size]="15" /> }
              @else if (index < current()) { <rms-cazo-icon name="check" [size]="15" /> }
              @else { {{ index + 1 }} }
            </span>
            <span class="rms-stepper__copy">
              <strong>{{ step.label }}</strong>
              @if (step.description) { <small>{{ step.description }}</small> }
              @else if (step.optional) { <small>Opcional</small> }
            </span>
          </button>
        </li>
      }
    </ol>
    <p class="rms-sr-only" aria-live="polite">Paso {{ current() + 1 }} de {{ steps().length }}: {{ steps()[current()]?.label }}</p>
  `,
  host: { class: 'rms-stepper' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperComponent {
  readonly steps = input.required<readonly StepItem[]>();
  readonly current = input.required<number>();
  /** Paso más avanzado alcanzado (por defecto el actual). */
  readonly maxReached = input<number | null>(null);
  readonly stepSelect = output<number>();

  protected readonly reached = computed(() => Math.max(this.current(), this.maxReached() ?? 0));
  protected readonly progress = computed(() => {
    const total = this.steps().length;
    return total <= 1 ? 100 : Math.round((this.current() / (total - 1)) * 100);
  });

  protected select(index: number): void {
    if (index !== this.current() && index <= this.reached()) this.stepSelect.emit(index);
  }
}
