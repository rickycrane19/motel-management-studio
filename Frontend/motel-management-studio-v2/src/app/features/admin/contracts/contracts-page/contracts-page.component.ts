import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import type { EmployeeContract } from '../../../../core/models/hr/contract.model';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { ContractsStore } from '../contracts.store';

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired' | 'ended';

const PAYMENT_LABEL: Record<string, string> = {
  Hourly: 'Por hora',
  Daily: 'Por día',
  PerShift: 'Por turno',
  Weekly: 'Semanal',
  Monthly: 'Mensual',
};

/**
 * Listado de contratos laborales (diseño portado del SH de restaurant v2):
 * vigencia, modalidad y salario de cada empleado, con terminado/historial.
 * El salario base del contrato alimenta la nómina y las tarifas de turno extra.
 */
@Component({
  selector: 'rms-contracts-page',
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent,
    DataTableCellDirective, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [ContractsStore],
  templateUrl: './contracts-page.component.html',
  styleUrl: './contracts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(ContractsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);

  protected readonly loaded = signal(false);
  protected readonly pageSizes = [20, 50, 100] as const;

  protected readonly statusControl = new FormControl<StatusFilter>('all', { nonNullable: true });
  protected readonly paymentTypeControl = new FormControl<string | null>(null);
  protected readonly statusOptions: readonly ComboboxOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Vigentes' },
    { value: 'expiring', label: 'Por vencer (30 días)' },
    { value: 'expired', label: 'Vencidos' },
    { value: 'ended', label: 'Terminados' },
  ];
  protected readonly paymentTypeOptions: readonly ComboboxOption<string>[] = [
    { value: 'Hourly', label: 'Por hora' },
    { value: 'Daily', label: 'Por día' },
    { value: 'PerShift', label: 'Por turno' },
    { value: 'Weekly', label: 'Semanal' },
    { value: 'Monthly', label: 'Mensual' },
  ];

  protected readonly canManage = computed(() => this.session.hasPermission('hr:manage'));
  protected readonly isLoading = computed(() => this.store.status() === 'loading' && !this.loaded());
  protected readonly trackContract = (row: EmployeeContract): number => row.contractId;

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'person', label: 'Empleado' },
    { key: 'type', label: 'Modalidad', width: '120px' },
    { key: 'term', label: 'Vigencia', width: '240px' },
    { key: 'pay', label: 'Salario base', align: 'end' },
    { key: 'status', label: 'Estado', width: '120px' },
    { key: 'actions', label: '', width: '96px', align: 'end' },
  ];

  ngOnInit(): void {
    this.statusControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.store.patchFilters({ status }));
    this.paymentTypeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paymentType) => this.store.patchFilters({ paymentType }));
    this.store.load();
    this.loaded.set(true);
  }

  protected onSearch(term: string): void {
    this.store.patchFilters({ search: term ?? '' });
  }

  protected clearFilters(): void {
    this.statusControl.setValue('all', { emitEvent: false });
    this.paymentTypeControl.setValue(null, { emitEvent: false });
    this.store.patchFilters({ search: '', paymentType: null, status: 'all' });
  }

  protected paymentLabel(type: string): string {
    return PAYMENT_LABEL[type] ?? type;
  }

  /** Etiqueta de vigencia: indefinido, vence pronto, ya venció o fecha. */
  protected termHint(row: EmployeeContract): string {
    if (!row.isActive) return 'Terminado';
    const days = row.daysToEnd;
    if (row.endDate === null) return 'Sin fecha de fin';
    if (days === null) return '';
    if (days < 0) return `Venció hace ${-days} días`;
    if (days === 0) return 'Vence hoy';
    if (days <= 30) return `Faltan ${days} días`;
    return '';
  }

  protected statusTone(row: EmployeeContract): 'success' | 'warning' | 'danger' | 'neutral' {
    if (!row.isActive) return 'neutral';
    const days = row.daysToEnd;
    if (days !== null && days < 0) return 'danger';
    if (days !== null && days <= 30) return 'warning';
    return 'success';
  }

  protected statusLabel(row: EmployeeContract): string {
    if (!row.isActive) return 'Terminado';
    const days = row.daysToEnd;
    if (days !== null && days < 0) return 'Vencido';
    if (days !== null && days <= 30) return 'Por vencer';
    return 'Vigente';
  }

  protected async endContract(row: EmployeeContract): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'Terminar contrato',
      message: 'El contrato pasa a historial sin borrarse: sus pagos y reportes quedan intactos. Registra uno nuevo cuando corresponda.',
      detail: `${row.employeeName} · ${this.paymentLabel(row.paymentType)}`,
      confirmLabel: 'Terminar contrato',
      tone: 'danger',
    });
    if (!accepted) return;
    this.store.setActive(row.contractId, false).subscribe((done) => {
      if (done) this.toast.success('Contrato terminado', row.employeeName);
      else this.toast.error('No se pudo terminar el contrato', this.store.errorMessage() ?? 'Intenta de nuevo.');
    });
  }

  protected async reopenContract(row: EmployeeContract): Promise<void> {
    const accepted = await this.confirm.ask({
      title: 'Reabrir contrato',
      message: '¿Volvemos este contrato a vigente? Úsalo solo si terminarlo fue un error.',
      detail: `${row.employeeName} · ${this.paymentLabel(row.paymentType)}`,
      confirmLabel: 'Reabrir',
      tone: 'warning',
    });
    if (!accepted) return;
    this.store.setActive(row.contractId, true).subscribe((done) => {
      if (done) this.toast.success('Contrato reabierto', row.employeeName);
      else this.toast.error('No se pudo reabrir el contrato', this.store.errorMessage() ?? 'Intenta de nuevo.');
    });
  }

  protected reload(): void {
    this.store.load();
  }
}
