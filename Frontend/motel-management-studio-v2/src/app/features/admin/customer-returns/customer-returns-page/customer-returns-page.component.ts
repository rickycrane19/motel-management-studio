import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { CustomerReturn } from '../../../../core/models/inventory/purchase.model';
import { CustomerReturnDetailEnvelope, CustomerReturnDetailItem, CustomerReturnService } from '../../../../core/services/inventory/customer-return.service';
import {
  CazoIconComponent,
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
import { CustomerReturnsStore } from '../customer-returns.store';

@Component({
  selector: 'rms-customer-returns-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, CazoIconComponent, DataTableComponent, DataTableCellDirective,
    DateFieldComponent, DrawerComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent,
    StatCardComponent, StatusBadgeComponent,
  ],
  providers: [CustomerReturnsStore],
  templateUrl: './customer-returns-page.component.html',
  styleUrl: './customer-returns-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnsPageComponent implements OnInit {
  protected readonly store = inject(CustomerReturnsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly customerReturnsService = inject(CustomerReturnService);
  private readonly loadedFor = signal<number | null>(null);

  protected readonly pageSizes = [20, 50, 100] as const;

  protected readonly selected = signal<CustomerReturn | null>(null);
  protected readonly selectedItems = signal<readonly CustomerReturnDetailItem[] | null>(null);
  protected readonly selectedLoading = signal(false);
  protected readonly selectedError = signal<string | null>(null);

  protected readonly startControl = new FormControl<string>(this.store.query().startDate, { nonNullable: true });
  protected readonly endControl = new FormControl<string>(this.store.query().endDate, { nonNullable: true });

  protected readonly canView = computed(() => this.session.hasPermission('inventory:view'));
  protected readonly canCreate = computed(() => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:movements'));

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'when', label: 'Cuándo', width: '150px' },
    { key: 'customer', label: 'Cliente · líneas' },
    { key: 'amount', label: 'Reembolso', width: '150px', align: 'end' },
    { key: 'cash', label: 'Caja', width: '110px', align: 'end' },
  ];
  protected readonly trackReturn = (row: CustomerReturn, _index: number): string => `${row.customerReturnId}`;

  ngOnInit(): void {
    this.startControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.endControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    if (!this.canView()) return;
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.applyFilters({ search: term ?? '' });
  }

  protected applyFilters(filters: Partial<{ search: string }> = {}): void {
    const startDate = this.startControl.value;
    const endDate = this.endControl.value;
    if (startDate && endDate && startDate > endDate) return;
    this.store.applyFilters({ startDate, endDate, ...filters });
  }

  protected clearFilters(): void {
    this.store.resetFilters();
    this.startControl.setValue(this.store.query().startDate, { emitEvent: false });
    this.endControl.setValue(this.store.query().endDate, { emitEvent: false });
  }

  /** Loop de detalle: el drawer pide las líneas de la devolución al backend. */
  protected open(customerReturn: CustomerReturn): void {
    this.selected.set(customerReturn);
    this.selectedError.set(null);
    if (this.loadedFor() === customerReturn.customerReturnId) return;
    this.selectedLoading.set(true);
    this.customerReturnsService.getById(customerReturn.customerReturnId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.selectedLoading.set(false)))
      .subscribe({
        next: (detail: CustomerReturnDetailEnvelope | null) => {
          if (detail) {
            this.selectedItems.set(detail.items ?? []);
            this.loadedFor.set(customerReturn.customerReturnId);
            this.selectedError.set(null);
          } else {
            this.selectedError.set('La devolución no fue encontrada.');
          }
        },
        error: (error: unknown) => this.selectedError.set(error instanceof Error ? error.message : 'No pudimos cargar las líneas de la devolución.'),
      });
  }

  protected closeDetail(): void {
    this.selected.set(null);
    this.selectedItems.set(null);
    this.loadedFor.set(null);
    this.selectedError.set(null);
  }

  protected customerOf(customerReturn: CustomerReturn): string {
    return customerReturn.customerName?.trim() || 'Cliente sin nombre';
  }
}
