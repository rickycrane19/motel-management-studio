import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  inject,
  input,
  output,
} from '@angular/core';

import { CazoIconComponent } from '../cazo-icon/cazo-icon.component';
import { EmptyStateComponent, EmptyStateKind } from '../empty-state/empty-state.component';

export interface DataTableColumn {
  readonly key: string;
  readonly label: string;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
  readonly sortable?: boolean;
}

export interface DataTableSort {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

/** Plantilla de celda: `<ng-template rmsCell="nombre" let-row>{{ row.name }}</ng-template>`. */
@Directive({ selector: 'ng-template[rmsCell]' })
export class DataTableCellDirective {
  readonly rmsCell = input.required<string>();
  readonly template = inject(TemplateRef);
}

/** Estado vacío propio: `<ng-template rmsTableEmpty>…</ng-template>`. */
@Directive({ selector: 'ng-template[rmsTableEmpty]' })
export class DataTableEmptyDirective {
  readonly template = inject(TemplateRef);
}

/**
 * Tabla estándar (patrón Productos): cabecera cacao, filas crema, skeleton al cargar, error con
 * reintento y vacío con acción. Pon `<rms-pager>` dentro para el pie paginado.
 */
@Component({
  selector: 'rms-data-table',
  imports: [NgTemplateOutlet, CazoIconComponent, EmptyStateComponent],
  template: `
    <div class="rms-table__scroll">
      <table [attr.aria-label]="caption()" [attr.aria-busy]="loading()" [class.is-refreshing]="loading() && rows().length > 0">
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th scope="col" [style.width]="column.width ?? null" [class]="'is-' + (column.align ?? 'start')" [attr.aria-sort]="ariaSort(column)">
                @if (column.sortable) {
                  <button type="button" class="rms-table__sort" (click)="toggleSort(column)">
                    <span>{{ column.label }}</span>
                    <rms-cazo-icon [name]="sortIcon(column)" [size]="13" />
                  </button>
                } @else {
                  {{ column.label }}
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading() && rows().length === 0) {
            @for (placeholder of skeleton(); track placeholder) {
              <tr class="rms-table__skeleton" aria-hidden="true">
                @for (column of columns(); track column.key) { <td><span class="rms-skeleton"></span></td> }
              </tr>
            }
          } @else if (error() && rows().length === 0) {
            <tr class="rms-table__state"><td [attr.colspan]="columns().length">
              <rms-empty-state kind="error" [title]="errorTitle()" [description]="error()" compact>
                <button type="button" class="rms-btn rms-btn--secondary" (click)="retry.emit()">Reintentar</button>
              </rms-empty-state>
            </td></tr>
          } @else if (rows().length === 0) {
            <tr class="rms-table__state"><td [attr.colspan]="columns().length">
              @if (emptyTemplate(); as custom) {
                <ng-container [ngTemplateOutlet]="custom.template" />
              } @else {
                <rms-empty-state [kind]="emptyKind()" [title]="emptyTitle()" [description]="emptyDescription()" compact />
              }
            </td></tr>
          } @else {
            @for (row of rows(); track trackRow(row, rowIndex); let rowIndex = $index) {
              <tr [class.is-clickable]="rowClickable()" [attr.data-row-state]="rowStateOf(row)" (click)="onRowClick(row)">
                @for (column of columns(); track column.key) {
                  <td [class]="'is-' + (column.align ?? 'start')">
                    @if (cellTemplates().get(column.key); as template) {
                      <ng-container [ngTemplateOutlet]="template" [ngTemplateOutletContext]="{ $implicit: row, row: row, index: rowIndex }" />
                    } @else {
                      {{ cellValue(row, column.key) }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
    <ng-content />
  `,
  host: { class: 'rms-table' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly rows = input.required<readonly T[]>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly errorTitle = input('No pudimos cargar la información');
  readonly emptyTitle = input('Todavía no hay registros');
  readonly emptyDescription = input<string | null>(null);
  readonly emptyKind = input<EmptyStateKind>('empty');
  readonly caption = input<string | null>(null);
  readonly skeletonRows = input(6);
  readonly rowClickable = input(false);
  /** Estado visual de la fila (fichas separadas por espacio: `selected`, `tone-warning`…); lo pinta `_ui.scss` con `data-row-state`. */
  readonly rowState = input<((row: T) => string | null) | null>(null);
  readonly sort = input<DataTableSort | null>(null);
  readonly trackBy = input<(row: T, index: number) => unknown>((_row, index) => index);
  readonly sortChange = output<DataTableSort>();
  readonly rowClick = output<T>();
  readonly retry = output<void>();

  private readonly cells = contentChildren(DataTableCellDirective);
  protected readonly emptyTemplate = contentChild(DataTableEmptyDirective);
  protected readonly cellTemplates = computed(() => new Map(this.cells().map((cell) => [cell.rmsCell(), cell.template])));
  protected readonly skeleton = computed(() => Array.from({ length: this.skeletonRows() }, (_, index) => index));

  protected rowStateOf(row: T): string | null {
    return this.rowState()?.(row) ?? null;
  }

  protected trackRow(row: T, index: number): unknown {
    return this.trackBy()(row, index);
  }

  protected cellValue(row: T, key: string): unknown {
    const value = (row as unknown as Record<string, unknown> | null)?.[key];
    return value === null || value === undefined || value === '' ? '—' : value;
  }

  protected onRowClick(row: T): void {
    if (this.rowClickable()) this.rowClick.emit(row);
  }

  protected toggleSort(column: DataTableColumn): void {
    const current = this.sort();
    const direction = current?.key === column.key && current.direction === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key: column.key, direction });
  }

  protected ariaSort(column: DataTableColumn): string | null {
    if (!column.sortable) return null;
    const current = this.sort();
    if (current?.key !== column.key) return 'none';
    return current.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(column: DataTableColumn): 'chevron-up' | 'chevron-down' {
    const current = this.sort();
    return current?.key === column.key && current.direction === 'desc' ? 'chevron-down' : 'chevron-up';
  }
}
