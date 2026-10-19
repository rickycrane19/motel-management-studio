import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';
import { FormsModule } from '@angular/forms';
import { ComboboxComponent, ComboboxOption } from '../combobox/combobox.component';

/**
 * Paginación de servidor (RT-05): «Mostrando 21–40 de 134 productos · Anterior / Siguiente».
 * `page` es 1-based; el componente no pagina en memoria: emite `pageChange` y el store consulta el SP.
 */
@Component({
  selector: 'rms-pager',
  imports: [CazoIconComponent, FormsModule, ComboboxComponent],
  template: `
    <p class="rms-pager__summary" aria-live="polite">
      @if (total() === 0) {
        Sin {{ label() }} para mostrar
      } @else {
        Mostrando <strong>{{ from() }}–{{ to() }}</strong> de <strong>{{ total() }}</strong> {{ label() }}
      }
    </p>
    <div class="rms-pager__actions">
      @if (pageSizeOptions().length > 1) {
        <label class="rms-pager__size">
          <span>Filas por página</span>
          <rms-combobox [ngModelOptions]="{ standalone: true }" class="rms-pager__combo" ariaLabel="Filas por página" [options]="sizeOptions()" [clearable]="false" [ngModel]="pageSize()" (ngModelChange)="changeSize($event)" [disabled]="loading()" />
        </label>
      }
      <button type="button" class="rms-btn rms-btn--secondary rms-btn--sm" [disabled]="!canPrevious() || loading()" (click)="go(page() - 1)">
        <rms-cazo-icon name="chevron-left" [size]="16" /><span>Anterior</span>
      </button>
      <button type="button" class="rms-btn rms-btn--secondary rms-btn--sm" [disabled]="!canNext() || loading()" (click)="go(page() + 1)">
        <span>Siguiente</span><rms-cazo-icon name="chevron-right" [size]="16" />
      </button>
    </div>
  `,
  host: { class: 'rms-pager' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly loading = input(false);
  /** Sustantivo en plural para el resumen: «productos», «clientes»… */
  readonly label = input('registros');
  readonly pageSizeOptions = input<readonly number[]>([]);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly lastPage = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))));
  protected readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
  protected readonly canPrevious = computed(() => this.page() > 1);
  protected readonly canNext = computed(() => this.page() < this.lastPage());

  protected go(page: number): void {
    const target = Math.min(Math.max(1, page), this.lastPage());
    if (target !== this.page()) this.pageChange.emit(target);
  }

  protected readonly sizeOptions = computed<readonly ComboboxOption<number>[]>(() =>
    this.pageSizeOptions().map((size) => ({ value: size, label: String(size) })));

  protected changeSize(value: number | string | null): void {
    const size = Number(value);
    if (Number.isInteger(size) && size > 0) this.pageSizeChange.emit(size);
  }
}
