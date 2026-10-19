import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { Supplier, SupplierDetail } from '../../../../core/models/inventory/supplier.model';
import { SupplierService } from '../../../../core/services/inventory/supplier.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { SuppliersStore } from '../suppliers.store';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'rms-suppliers-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DrawerComponent, EmptyStateComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [SuppliersStore],
  templateUrl: './suppliers-page.component.html',
  styleUrl: './suppliers-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuppliersPageComponent implements OnInit {
  protected readonly store = inject(SuppliersStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly suppliersService = inject(SupplierService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly selected = signal<Supplier | null>(null);
  protected readonly detail = signal<SupplierDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  private readonly loadedFor = signal<number | null>(null);

  protected readonly statusControl = new FormControl<StatusFilter>('all', { nonNullable: true });
  protected readonly statusOptions: readonly ComboboxOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Desactivados' },
  ];
  protected readonly pageSizes = [10, 20, 50] as const;
  protected readonly trackSupplier = (row: Supplier): number => row.supplierId;
  protected readonly money = (amount: number): string => `C$ ${amount.toFixed(2)}`;

  protected readonly columns = computed<readonly DataTableColumn[]>(() => [
    { key: 'name', label: 'Proveedor' },
    { key: 'contact', label: 'Contacto' },
    { key: 'purchases', label: 'Compras' },
    { key: 'createdOn', label: 'Registro' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: 'Acciones', align: 'end' },
  ]);

  protected readonly canView = computed(() => this.session.hasPermission('inventory:view'));
  protected readonly canCreate = computed(() => this.session.hasPermission('inventory:create'));
  protected readonly canUpdate = computed(() => this.session.hasPermission('inventory:update'));
  protected readonly activeFilters = computed(() => (this.store.query().isActive !== null ? 1 : 0));
  protected readonly tableError = computed(() => (this.store.status() === 'error' ? this.store.errorMessage() : null));

  ngOnInit(): void {
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    if (!this.canView()) return;
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ ...this.currentFilters(), search: term });
  }

  protected clearFilters(): void {
    this.statusControl.setValue('all', { emitEvent: false });
    this.store.resetFilters();
  }

  private applyFilters(): void {
    this.store.applyFilters(this.currentFilters());
  }

  private currentFilters() {
    const status = this.statusControl.value;
    return {
      search: this.store.query().search,
      isActive: status === 'all' ? null : status === 'active',
    };
  }

  protected setPageSize(size: number): void {
    this.store.load({ pageSize: size, pageNumber: 1 });
  }

  /** Abre el detalle y pide las últimas compras al backend. */
  protected open(supplier: Supplier): void {
    this.selected.set(supplier);
    this.detailError.set(null);
    if (this.loadedFor() === supplier.supplierId) return;
    this.detailLoading.set(true);
    this.suppliersService.getById(supplier.supplierId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.detailLoading.set(false)))
      .subscribe({
        next: (detail) => {
          if (detail) {
            this.detail.set(detail);
            this.loadedFor.set(supplier.supplierId);
            this.detailError.set(null);
          } else {
            this.detailError.set('No encontramos este proveedor.');
          }
        },
        error: () => this.detailError.set('No pudimos cargar el detalle del proveedor.'),
      });
  }

  protected closeDetail(): void {
    this.selected.set(null);
    this.detail.set(null);
    this.loadedFor.set(null);
    this.detailError.set(null);
  }

  protected contactLine(supplier: Supplier): string {
    return supplier.contactName?.trim() || supplier.phone?.trim() || 'Sin contacto';
  }

  protected when(value: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(parsed);
  }

  protected async toggleStatus(supplier: Supplier): Promise<void> {
    if (!this.network.online()) return;
    const deactivating = supplier.isActive;
    const accepted = await this.confirm.ask({
      title: deactivating ? 'Desactivar proveedor' : 'Activar proveedor',
      message: deactivating
        ? 'Dejará de aparecer al elegir proveedor en las compras. Las compras ya registradas no cambian: puedes activarlo otra vez cuando quieras.'
        : 'Volverá a estar disponible al registrar compras.',
      detail: supplier.name,
      confirmLabel: deactivating ? 'Desactivar' : 'Activar',
      tone: deactivating ? 'warning' : 'primary',
    });
    if (!accepted) return;
    this.store.setActive(supplier, !supplier.isActive).subscribe((done) => {
      if (!done) {
        this.toast.error('No se pudo cambiar el estado', this.store.errorMessage() ?? 'Inténtalo de nuevo en unos segundos.');
        return;
      }
      this.toast.success(deactivating ? 'Proveedor desactivado' : 'Proveedor activado', supplier.name);
      this.closeDetail();
      this.store.load({ pageNumber: this.store.query().pageNumber });
    });
  }
}
