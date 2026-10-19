import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { FineType } from '../../../../core/models/service/catalog.model';
import { formatInstantInTimeZone } from '../../../../core/time/location-date';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  DataTableColumn,
  DataTableComponent,
  EmptyStateComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { FineTypesStore } from '../fine-types.store';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'rms-fine-types-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent,
    EmptyStateComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [FineTypesStore],
  templateUrl: './fine-types-page.component.html',
  styleUrl: './fine-types-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FineTypesPageComponent implements OnInit {
  protected readonly store = inject(FineTypesStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly statusControl = new FormControl<StatusFilter>('all', { nonNullable: true });
  protected readonly statusOptions: readonly ComboboxOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Desactivados' },
  ];
  protected readonly pageSizes = [10, 20, 50] as const;
  protected readonly trackFineType = (row: FineType): number => row.fineTypeId;
  protected readonly money = (amount: number): string => `C$ ${amount.toFixed(2)}`;

  protected readonly columns = computed<readonly DataTableColumn[]>(() => [
    { key: 'name', label: 'Tipo de multa' },
    { key: 'description', label: 'Qué cubre' },
    { key: 'amount', label: 'Monto por defecto', align: 'end' },
    { key: 'createdOn', label: 'Registro' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: 'Acciones', align: 'end' },
  ]);

  protected readonly canView = computed(() => this.session.hasPermission('service.fine-types'));
  protected readonly canManage = computed(() => this.session.hasPermission('service.fine-types'));
  protected readonly activeFilters = computed(() => (this.store.query().isActive !== null ? 1 : 0));
  protected readonly tableError = computed(() => (this.store.status() === 'error' ? this.store.errorMessage() : null));

  ngOnInit(): void {
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ ...this.currentFilters(), name: term });
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
      name: this.store.query().name,
      isActive: status === 'all' ? null : status === 'active',
    };
  }

  protected setPageSize(size: number): void {
    this.store.load({ pageSize: size, pageNumber: 1 });
  }

  protected createdLabel(fineType: FineType): string {
    return formatInstantInTimeZone(fineType.createdOn, this.session.session()?.tenant?.timeZone, 'medium');
  }

  protected async toggleStatus(fineType: FineType): Promise<void> {
    if (!this.network.online()) return;
    const deactivating = fineType.isActive;
    const accepted = await this.confirm.ask({
      title: deactivating ? 'Desactivar tipo de multa' : 'Activar tipo de multa',
      message: deactivating
        ? 'Dejará de ofrecerse al registrar multas en recepción. Las multas ya aplicadas no cambian: puedes activarlo otra vez cuando quieras.'
        : 'Volverá a estar disponible al registrar multas en las estancias.',
      detail: fineType.name,
      confirmLabel: deactivating ? 'Desactivar' : 'Activar',
      tone: deactivating ? 'warning' : 'primary',
    });
    if (!accepted) return;
    this.store.setActive(fineType, !fineType.isActive).subscribe((done) => {
      if (!done) {
        this.toast.error('No se pudo cambiar el estado', this.store.errorMessage() ?? 'Inténtalo de nuevo en unos segundos.');
        return;
      }
      this.toast.success(deactivating ? 'Tipo de multa desactivado' : 'Tipo de multa activado', fineType.name);
      this.store.load({ pageNumber: this.store.query().pageNumber });
    });
  }
}
