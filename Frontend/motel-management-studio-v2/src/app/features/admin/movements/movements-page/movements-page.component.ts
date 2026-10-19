import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { InventoryMovement, InventoryMovementQuery } from '../../../../core/models/inventory/movement.model';
import { ProductService } from '../../../../core/services/inventory/product.service';
import { IN_MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS, movementSign, OUT_MOVEMENT_TYPES } from '../../../../core/services/inventory/movement.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DateFieldComponent,
  DrawerComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
} from '../../../../shared/ui';
import { MovementsStore } from '../movements.store';

@Component({
  selector: 'rms-movements-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DateFieldComponent, DrawerComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [MovementsStore],
  templateUrl: './movements-page.component.html',
  styleUrl: './movements-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementsPageComponent implements OnInit {
  protected readonly store = inject(MovementsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productsService = inject(ProductService);

  protected readonly selected = signal<InventoryMovement | null>(null);
  protected readonly pageSizes = [10, 20, 50, 100, 200] as const;

  protected readonly startControl = new FormControl<string>(this.store.query().startDate, { nonNullable: true });
  protected readonly endControl = new FormControl<string>(this.store.query().endDate, { nonNullable: true });
  protected readonly typeControl = new FormControl<string | null>(null);

  protected readonly typeOptions: readonly ComboboxOption<string>[] = [
    ...[...IN_MOVEMENT_TYPES, ...OUT_MOVEMENT_TYPES].map((type) => ({
      value: type,
      label: MOVEMENT_TYPE_LABELS[type] ?? type,
      hint: movementSign(type) > 0 ? 'Entrada' : 'Salida',
    })),
  ];
  protected readonly movementSign = movementSign;
  private readonly productUnits = signal<ReadonlyMap<number, string>>(new Map());

  protected readonly canView = computed(() => this.session.hasPermission('inventory:view'));
  protected readonly canRecord = computed(() => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:movements'));

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'when', label: 'Cuándo', width: '150px' },
    { key: 'product', label: 'Producto' },
    { key: 'type', label: 'Qué pasó', width: '230px' },
    { key: 'quantity', label: 'Cantidad', width: '130px', align: 'end' },
    { key: 'balance', label: 'Saldo', width: '150px', align: 'end' },
    { key: 'cost', label: 'Costo', width: '150px', align: 'end' },
  ];
  protected readonly trackMovement = (row: InventoryMovement, _index: number): string => `${row.movementId}-${row.movementType}-${row.createdOnUtc}`;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.typeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((movementType) => this.applyFilters({ movementType }));
    if (!this.canView()) return;
    this.store.load();
    this.loadUnits();
  }

  protected typeLabel(type: string): string {
    return MOVEMENT_TYPE_LABELS[type] ?? type;
  }

  protected unitOf(productId: number): string {
    return this.productUnits().get(productId) ?? '';
  }

  protected onSearch(term: string): void {
    this.applyFilters({ search: term ?? '' });
  }

  protected applyFilters(filters: Partial<InventoryMovementQuery> = {}): void {
    const startDate = this.startControl.value;
    const endDate = this.endControl.value;
    if (startDate && endDate && startDate > endDate) return;
    this.store.applyFilters({ startDate, endDate, ...filters });
  }

  protected clearFilters(): void {
    this.typeControl.setValue(null, { emitEvent: false });
    this.store.resetFilters();
    this.startControl.setValue(this.store.query().startDate, { emitEvent: false });
    this.endControl.setValue(this.store.query().endDate, { emitEvent: false });
  }

  /** Loop de detalle: fecha y doc. referencia son los datos que faltan cuando algo no cuadra. */
  protected open(movement: InventoryMovement): void {
    this.selected.set(movement);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  private loadUnits(): void {
    this.productsService.list({ pageNumber: 1, pageSize: 200, name: '', categoryId: null, isActive: null })
      .pipe(catchError(() => of({ items: [] as never[], totalRecords: 0, page: 1, pageSize: 200 })), map((page) => page.items), takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.productUnits.set(new Map(products.map((product) => [product.productId, product.unitOfMeasure])));
      });
  }
}
