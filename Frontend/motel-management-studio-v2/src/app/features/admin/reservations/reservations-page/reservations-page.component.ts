import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import {
  RESERVATION_STATUS,
  RoomReservation,
  RoomReservationUpsert,
} from '../../../../core/models/service/reservation.model';
import { ApiService } from '../../../../core/services/api.service';
import { CustomerService } from '../../../../core/services/service/customer.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxLoader,
  ComboboxOption,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DateFieldComponent,
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
import { ReservationsStore } from '../reservations.store';

const STATUS_OPTIONS: readonly ComboboxOption<string>[] = [
  { value: '1', label: 'Confirmadas' },
  { value: '2', label: 'Check-In' },
  { value: '3', label: 'Canceladas' },
  { value: '4', label: 'No Show' },
];

/** Hora local de Managua en el formato que espera `<input type="datetime-local">`. */
function managuaInput(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'America/Managua', hour12: false }).slice(0, 16).replace(' ', 'T');
}

function addHours(value: string, hours: number): string {
  if (!value) return '';
  const date = new Date(`${value}:00-06:00`);
  if (Number.isNaN(date.getTime())) return value;
  date.setTime(date.getTime() + hours * 3_600_000);
  return managuaInput(date);
}

/** Reservaciones de habitaciones: alta, agenda, cancelación y No Show. */
@Component({
  selector: 'rms-reservations-page',
  imports: [
    ReactiveFormsModule, DatePipe, CazoIconComponent, ComboboxComponent, DataTableComponent,
    DataTableCellDirective, DateFieldComponent, DrawerComponent, FieldComponent, FilterBarComponent,
    NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [ReservationsStore],
  templateUrl: './reservations-page.component.html',
  styleUrl: './reservations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly customersService = inject(CustomerService);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(ReservationsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);

  protected readonly selected = signal<RoomReservation | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly pendingClose = signal<'cancel' | 'noShow' | null>(null);
  protected readonly pageSizes = [20, 50, 100] as const;

  protected readonly canView = computed(() => this.session.hasPermission('service:view'));
  protected readonly canManage = computed(() => this.session.hasPermission('service:manage'));
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusFilter = new FormControl<string | null>(null);
  protected readonly fromControl = new FormControl<string | null>(null);
  protected readonly toControl = new FormControl<string | null>(null);

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'customer', label: 'Cliente' },
    { key: 'room', label: 'Habitación', width: '170px' },
    { key: 'schedule', label: 'Horario', width: '230px' },
    { key: 'deposit', label: 'Abono', width: '130px', align: 'end' },
    { key: 'status', label: 'Estado', width: '130px' },
    { key: 'actions', label: '', width: '90px' },
  ];
  protected readonly trackReservation = (row: RoomReservation, _index: number): number => row.reservationId;

  protected readonly form = this.formBuilder.nonNullable.group({
    roomId: this.formBuilder.control<number | null>(null, Validators.required),
    customerId: this.formBuilder.control<number | null>(null),
    customerName: ['', [Validators.required, Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(50)],
    serviceStayTypeId: this.formBuilder.control<number | null>(null, Validators.required),
    startLocal: ['', Validators.required],
    endLocal: ['', Validators.required],
    depositAmount: [0, [Validators.min(0)]],
    notes: ['', Validators.maxLength(300)],
  });

  private stayTypes: readonly { serviceStayTypeId: number; name: string; durationHours: number; price: number }[] = [];
  private customers: readonly { customerId: number; fullName: string; phone: string | null; email: string | null }[] = [];

  protected readonly searchRooms: ComboboxLoader<number> = (term) => this.api.getRooms().pipe(
    map((rooms) => rooms
      .filter((room) => !term || room.roomNumber.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 30)
      .map((room) => ({
        value: room.roomId,
        label: `Habitación ${room.roomNumber}`,
        hint: `${room.roomTypeName} · ${room.statusName}`,
      }))),
  );

  protected readonly searchStayTypes: ComboboxLoader<number> = (term) => this.api.getStayTypes().pipe(
    map((types) => {
      this.stayTypes = types;
      return types
        .filter((type) => type.isActive && !type.isExtension)
        .filter((type) => !term || type.name.toLowerCase().includes(term.toLowerCase()))
        .map((type) => ({
          value: type.serviceStayTypeId,
          label: type.name,
          hint: `${type.durationHours} h · C$ ${type.price.toLocaleString('es-NI')}`,
        }));
    }),
  );

  protected readonly searchCustomers: ComboboxLoader<number> = (term) => this.customersService
    .list({ pageNumber: 1, pageSize: 20, search: term ?? '', onlyActive: true })
    .pipe(map((page) => {
      this.customers = page.items;
      return page.items.map((customer) => ({
        value: customer.customerId,
        label: customer.fullName,
        hint: customer.phone ?? customer.email ?? 'Sin contacto',
      }));
    }));

  ngOnInit(): void {
    if (!this.canView()) return;

    this.statusFilter.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.store.applyFilters({ status: value === null ? null : Number(value) });
    });
    this.fromControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.store.applyFilters({ fromDate: value });
    });
    this.toControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.store.applyFilters({ toDate: value });
    });

    this.form.controls.serviceStayTypeId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typeId) => this.syncEndTime(typeId));
    this.form.controls.startLocal.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncEndTime(this.form.controls.serviceStayTypeId.value));

    this.form.controls.customerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((customerId) => {
        if (customerId === null) return;
        const customer = this.customers.find((item) => item.customerId === customerId);
        if (!customer) return;
        this.form.patchValue(
          { customerName: customer.fullName, phone: customer.phone ?? '' },
          { emitEvent: false },
        );
      });

    this.form.controls.customerName.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        const linked = this.customers.find((item) => item.customerId === this.form.controls.customerId.value);
        if (linked && name !== linked.fullName) {
          this.form.controls.customerId.setValue(null, { emitEvent: false });
        }
      });

    this.store.load();
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ search: term ?? '' });
  }

  protected clearFilters(): void {
    this.statusFilter.setValue(null, { emitEvent: false });
    this.fromControl.setValue(null, { emitEvent: false });
    this.toControl.setValue(null, { emitEvent: false });
    this.store.resetFilters();
  }

  protected open(reservation: RoomReservation): void {
    this.pendingClose.set(null);
    this.selected.set(reservation);
  }

  protected closeDetail(): void {
    this.pendingClose.set(null);
    this.selected.set(null);
  }

  protected openCreate(): void {
    const start = new Date();
    start.setTime(start.getTime() + 3_600_000);
    const startValue = managuaInput(start);

    this.saveError.set(null);
    this.form.reset({
      roomId: null,
      customerId: null,
      customerName: '',
      phone: '',
      serviceStayTypeId: null,
      startLocal: startValue,
      endLocal: addHours(startValue, 3),
      depositAmount: 0,
      notes: '',
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
    if (!value.roomId || !value.serviceStayTypeId) {
      this.saveError.set('Elige la habitación y la tarifa de la reservación.');
      return;
    }
    if (!value.startLocal || !value.endLocal) {
      this.saveError.set('Indica la fecha y hora de llegada y de salida.');
      return;
    }
    if (new Date(`${value.endLocal}:00-06:00`) <= new Date(`${value.startLocal}:00-06:00`)) {
      this.saveError.set('La salida debe ser posterior a la llegada.');
      return;
    }

    const payload: RoomReservationUpsert = {
      roomId: value.roomId,
      customerId: value.customerId,
      customerName: value.customerName.trim(),
      phone: value.phone.trim() || null,
      serviceStayTypeId: value.serviceStayTypeId,
      reservationStartUtc: value.startLocal,
      reservationEndUtc: value.endLocal,
      depositAmount: Number(value.depositAmount) || 0,
      notes: value.notes.trim() || null,
    };

    this.saveError.set(null);
    this.store.create(payload).subscribe((saved) => {
      if (!saved) {
        this.saveError.set(this.store.errorMessage() ?? 'No pudimos guardar la reservación.');
        return;
      }
      this.toast.success('Reservación creada', `${payload.customerName} · ${value.startLocal.replace('T', ' ')}`);
      this.formOpen.set(false);
      this.store.load({ pageNumber: 1 });
    });
  }

  protected askClose(action: 'cancel' | 'noShow'): void {
    if (this.pendingClose() === action) {
      this.applyClose(action);
      return;
    }
    this.pendingClose.set(action);
  }

  protected cancelPending(): void {
    this.pendingClose.set(null);
  }

  private applyClose(action: 'cancel' | 'noShow'): void {
    const reservation = this.selected();
    if (!reservation) return;

    const status = action === 'cancel' ? RESERVATION_STATUS.cancelled : RESERVATION_STATUS.noShow;
    this.store.setStatus(reservation, status).subscribe((changed) => {
      if (!changed) {
        this.toast.error('No pudimos actualizar la reservación', this.store.errorMessage() ?? undefined);
        return;
      }
      this.toast.success(
        action === 'cancel' ? 'Reservación cancelada' : 'Reservación marcada como No Show',
        reservation.customerName,
      );
      this.pendingClose.set(null);
      this.selected.set(null);
      this.store.load({ pageNumber: this.store.query().pageNumber });
    });
  }

  protected statusTone(status: number): 'brand' | 'success' | 'neutral' | 'warning' {
    if (status === RESERVATION_STATUS.confirmed) return 'brand';
    if (status === RESERVATION_STATUS.checkedIn) return 'success';
    if (status === RESERVATION_STATUS.noShow) return 'warning';
    return 'neutral';
  }

  protected isClosed(reservation: RoomReservation): boolean {
    return reservation.statusCode === RESERVATION_STATUS.cancelled || reservation.statusCode === RESERVATION_STATUS.noShow;
  }

  protected deposit(reservation: RoomReservation): string {
    return `C$ ${Number(reservation.depositAmount).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private syncEndTime(typeId: number | null): void {
    if (typeId === null) return;
    const start = this.form.controls.startLocal.value;
    if (!start) return;
    const type = this.stayTypes.find((item) => item.serviceStayTypeId === typeId);
    if (!type || type.durationHours <= 0) return;
    this.form.controls.endLocal.setValue(addHours(start, type.durationHours), { emitEvent: false });
  }
}
