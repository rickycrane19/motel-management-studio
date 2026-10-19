import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { Customer, CustomerUpsert } from '../../../../core/models/service/customer.model';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DrawerComponent,
  FieldComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { CustomersStore } from '../customers.store';

const STATUS_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
];

function initialsOf(customer: Customer): string {
  return customer.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';
}

/** Clientes del motel: ficha de contacto, alta, edición y estado. */
@Component({
  selector: 'rms-customers-page',
  imports: [
    ReactiveFormsModule, DatePipe, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DrawerComponent, FieldComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent,
    StatCardComponent, StatusBadgeComponent,
  ],
  providers: [CustomersStore],
  templateUrl: './customers-page.component.html',
  styleUrl: './customers-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(CustomersStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);

  protected readonly selected = signal<Customer | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly pageSizes = [10, 20, 50] as const;

  protected readonly canView = computed(() => this.session.hasPermission('service:view'));
  protected readonly canManage = computed(() => this.session.hasPermission('service:manage'));
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusFilter = new FormControl<string>('all', { nonNullable: true });
  protected readonly initialsOf = initialsOf;

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'customer', label: 'Cliente' },
    { key: 'contact', label: 'Contacto' },
    { key: 'document', label: 'Documento', width: '150px' },
    { key: 'since', label: 'Cliente desde', width: '150px' },
    { key: 'status', label: 'Estado', width: '120px' },
    { key: 'actions', label: '', width: '110px' },
  ];
  protected readonly trackCustomer = (row: Customer, _index: number): number => row.customerId;

  protected readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    documentNumber: ['', Validators.maxLength(50)],
    phone: ['', Validators.maxLength(50)],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    notes: ['', Validators.maxLength(300)],
  });

  ngOnInit(): void {
    if (!this.canView()) return;
    this.statusFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      this.store.applyFilters({ onlyActive: status === 'all' ? null : status === 'active' });
    });
    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ search: term ?? '' });
  }

  protected clearFilters(): void {
    this.statusFilter.setValue('all', { emitEvent: false });
    this.store.resetFilters();
  }

  protected open(customer: Customer): void {
    this.selected.set(customer);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.saveError.set(null);
    this.form.reset({ fullName: '', documentNumber: '', phone: '', email: '', notes: '' });
    this.formOpen.set(true);
  }

  protected openEdit(customer: Customer): void {
    this.editingId.set(customer.customerId);
    this.saveError.set(null);
    this.selected.set(null);
    this.form.reset({
      fullName: customer.fullName,
      documentNumber: customer.documentNumber ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
    });
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    if (this.store.saving()) return;
    this.formOpen.set(false);
    this.saveError.set(null);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.saving()) return;

    const value = this.form.getRawValue();
    const payload: CustomerUpsert = {
      fullName: value.fullName.trim(),
      documentNumber: value.documentNumber.trim() || null,
      phone: value.phone.trim() || null,
      email: value.email.trim() || null,
      notes: value.notes.trim() || null,
    };

    const isCreate = this.editingId() === null;
    this.saveError.set(null);
    this.store.save(payload, this.editingId()).subscribe((saved) => {
      if (!saved) {
        this.saveError.set(this.store.errorMessage() ?? 'No pudimos guardar el cliente.');
        return;
      }
      this.toast.success(isCreate ? 'Cliente creado' : 'Cliente actualizado', payload.fullName);
      this.formOpen.set(false);
      this.store.load({ pageNumber: isCreate ? 1 : this.store.query().pageNumber });
    });
  }

  protected toggleActive(customer: Customer, event: Event): void {
    event.stopPropagation();
    if (!this.canManage()) return;
    this.store.setActive(customer, !customer.isActive).subscribe((changed) => {
      if (!changed) {
        this.toast.error('No pudimos cambiar el estado', this.store.errorMessage() ?? undefined);
        return;
      }
      this.toast.success(customer.isActive ? 'Cliente desactivado' : 'Cliente activado', customer.fullName);
      this.selected.update((current) => current && current.customerId === customer.customerId
        ? { ...current, isActive: !customer.isActive }
        : current);
      this.store.load({ pageNumber: this.store.query().pageNumber });
    });
  }
}
