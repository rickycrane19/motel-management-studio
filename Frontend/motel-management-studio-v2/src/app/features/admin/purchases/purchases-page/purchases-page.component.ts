import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { Purchase } from '../../../../core/models/inventory/purchase.model';
import { PURCHASE_TYPE_LABELS, PurchaseDetailEnvelope, PurchaseDetailItem, PurchaseService } from '../../../../core/services/inventory/purchase.service';
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
import { PurchasesStore } from '../purchases.store';

@Component({
  selector: 'rms-purchases-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DateFieldComponent, DrawerComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent,
    StatCardComponent, StatusBadgeComponent,
  ],
  providers: [PurchasesStore],
  templateUrl: './purchases-page.component.html',
  styleUrl: './purchases-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchasesPageComponent implements OnInit {
  protected readonly store = inject(PurchasesStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly purchasesService = inject(PurchaseService);
  private readonly loadedFor = signal<number | null>(null);

  protected readonly typeLabel = (type: string): string => PURCHASE_TYPE_LABELS[type as keyof typeof PURCHASE_TYPE_LABELS] ?? type;
  protected readonly pageSizes = [20, 50, 100] as const;

  protected readonly selected = signal<Purchase | null>(null);
  protected readonly selectedItems = signal<readonly PurchaseDetailItem[] | null>(null);
  protected readonly selectedLoading = signal(false);
  protected readonly selectedError = signal<string | null>(null);

  protected readonly startControl = new FormControl<string>(this.store.query().startDate, { nonNullable: true });
  protected readonly endControl = new FormControl<string>(this.store.query().endDate, { nonNullable: true });
  protected readonly typeControl = new FormControl<string | null>(null);

  protected readonly typeOptions: readonly ComboboxOption<string>[] = [
    { value: 'Compra', label: PURCHASE_TYPE_LABELS['Compra'], hint: 'Entra inventario · paga' },
    { value: 'DevolucionProveedor', label: PURCHASE_TYPE_LABELS['DevolucionProveedor'], hint: 'Sale inventario · reintegro' },
  ];

  protected readonly canView = computed(() => this.session.hasPermission('inventory:view'));
  protected readonly canCreate = computed(() => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:movements'));

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'when', label: 'Cuándo', width: '150px' },
    { key: 'document', label: 'Documento' },
    { key: 'amount', label: 'Importe', width: '150px', align: 'end' },
    { key: 'cash', label: 'Caja', width: '110px', align: 'end' },
  ];
  protected readonly trackPurchase = (row: Purchase, _index: number): string => `${row.purchaseId}-${row.purchaseType}`;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.typeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((purchaseType) =>
      this.applyFilters({ purchaseType: (purchaseType as Purchase['purchaseType'] | null) ?? null }));
    if (!this.canView()) return;
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.applyFilters({ search: term ?? '' });
  }

  protected applyFilters(filters: Partial<{ search: string; purchaseType: Purchase['purchaseType'] | null }> = {}): void {
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

  /** Loop de detalle: el drawer pide las líneas del documento al backend. */
  protected open(purchase: Purchase): void {
    this.selected.set(purchase);
    this.selectedError.set(null);
    if (this.loadedFor() === purchase.purchaseId) return;
    this.selectedLoading.set(true);
    this.purchasesService.getById(purchase.purchaseId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.selectedLoading.set(false)))
      .subscribe({
        next: (detail: PurchaseDetailEnvelope | null) => {
          if (detail) {
            this.selectedItems.set(detail.items ?? []);
            this.loadedFor.set(purchase.purchaseId);
            this.selectedError.set(null);
          } else {
            this.selectedError.set('El documento no fue encontrado.');
          }
        },
        error: (error: unknown) => this.selectedError.set(error instanceof Error ? error.message : 'No pudimos cargar las líneas del documento.'),
      });
  }

  protected closeDetail(): void {
    this.selected.set(null);
    this.selectedItems.set(null);
    this.loadedFor.set(null);
    this.selectedError.set(null);
  }

  protected supplierOf(purchase: Purchase): string {
    return purchase.supplierName?.trim() || 'Sin proveedor registrado';
  }
}
