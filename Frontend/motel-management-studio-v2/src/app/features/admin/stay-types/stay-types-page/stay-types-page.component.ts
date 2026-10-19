import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { ServiceStayType } from '../../../../core/models/service/catalog.model';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
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
import { StayTypesStore } from '../stay-types.store';

type StatusFilter = 'all' | 'active' | 'inactive';
type KindFilter = 'all' | 'stay' | 'extension';

@Component({
  selector: 'rms-stay-types-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent, DrawerComponent,
    EmptyStateComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [StayTypesStore],
  templateUrl: './stay-types-page.component.html',
  styleUrl: './stay-types-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StayTypesPageComponent implements OnInit {
  protected readonly store = inject(StayTypesStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly selected = signal<ServiceStayType | null>(null);
  protected readonly statusControl = new FormControl<StatusFilter>('all', { nonNullable: true });
  protected readonly kindControl = new FormControl<KindFilter>('all', { nonNullable: true });
  protected readonly statusOptions: readonly ComboboxOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Desactivadas' },
  ];
  protected readonly kindOptions: readonly ComboboxOption<KindFilter>[] = [
    { value: 'all', label: 'Permanencia y extensión' },
    { value: 'stay', label: 'Solo permanencia' },
    { value: 'extension', label: 'Solo extensiones' },
  ];
  protected readonly pageSizes = [10, 20, 50] as const;
  protected readonly trackStayType = (row: ServiceStayType): number => row.serviceStayTypeId;
  protected readonly detailSubtitle = computed(() => {
    const stayType = this.selected();
    return stayType ? (stayType.roomTypeName ?? 'Todo el motel') : null;
  });
  protected readonly money = (amount: number): string => `C$ ${amount.toFixed(2)}`;

  protected readonly columns = computed<readonly DataTableColumn[]>(() => [
    { key: 'name', label: 'Tarifa' },
    { key: 'roomType', label: 'Tipo de cuarto' },
    { key: 'duration', label: 'Duración' },
    { key: 'price', label: 'Precio', align: 'end' },
    { key: 'kind', label: 'Tipo' },
    { key: 'status', label: 'Estado' },
    { key: 'actions', label: 'Acciones', align: 'end' },
  ]);

  protected readonly canView = computed(() => this.session.hasPermission('service.stay-types'));
  protected readonly canManage = computed(() => this.session.hasPermission('service.stay-types'));
  protected readonly activeFilters = computed(() => {
    const query = this.store.query();
    return (query.isActive !== null ? 1 : 0) + (query.isExtension !== null ? 1 : 0);
  });
  protected readonly tableError = computed(() => (this.store.status() === 'error' ? this.store.errorMessage() : null));

  ngOnInit(): void {
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.kindControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ ...this.currentFilters(), name: term });
  }

  protected clearFilters(): void {
    this.statusControl.setValue('all', { emitEvent: false });
    this.kindControl.setValue('all', { emitEvent: false });
    this.store.resetFilters();
  }

  private applyFilters(): void {
    this.store.applyFilters(this.currentFilters());
  }

  private currentFilters() {
    const status = this.statusControl.value;
    const kind = this.kindControl.value;
    return {
      name: this.store.query().name,
      isActive: status === 'all' ? null : status === 'active',
      isExtension: kind === 'all' ? null : kind === 'extension',
    };
  }

  protected setPageSize(size: number): void {
    this.store.load({ pageSize: size, pageNumber: 1 });
  }

  protected open(stayType: ServiceStayType): void {
    this.selected.set(stayType);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected roomTypeLabel(stayType: ServiceStayType): string {
    return stayType.roomTypeName ?? 'Todo el motel';
  }

  protected durationLabel(stayType: ServiceStayType): string {
    const hours = stayType.durationHours;
    const rounded = Number.isInteger(hours) ? hours : hours.toFixed(1);
    return `${rounded} ${hours === 1 ? 'hora' : 'horas'}`;
  }

  protected async toggleStatus(stayType: ServiceStayType): Promise<void> {
    if (!this.network.online()) return;
    const deactivating = stayType.isActive;
    const accepted = await this.confirm.ask({
      title: deactivating ? 'Desactivar tarifa' : 'Activar tarifa',
      message: deactivating
        ? 'Dejará de ofrecerse en recepción al hospedar o extender. No se borra: puedes activarla otra vez cuando quieras.'
        : 'Volverá a estar disponible para hospedar y extender estancias.',
      detail: stayType.name,
      confirmLabel: deactivating ? 'Desactivar' : 'Activar',
      tone: deactivating ? 'warning' : 'primary',
    });
    if (!accepted) return;
    this.store.setActive(stayType, !stayType.isActive).subscribe((done) => {
      if (!done) {
        this.toast.error('No se pudo cambiar el estado', this.store.errorMessage() ?? 'Inténtalo de nuevo en unos segundos.');
        return;
      }
      this.toast.success(deactivating ? 'Tarifa desactivada' : 'Tarifa activada', stayType.name);
      this.selected.set(null);
      this.store.load({ pageNumber: this.store.query().pageNumber });
    });
  }
}
