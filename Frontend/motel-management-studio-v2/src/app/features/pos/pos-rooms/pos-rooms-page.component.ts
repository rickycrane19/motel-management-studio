import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { NetworkStatusService } from '../../../core/browser/network-status.service';
import { describeApiError } from '../../../core/http/api-error';
import {
  CashSessionSummary,
  FineTypeItem,
  RoomItem,
  RoomStayDetail,
  ServiceStayTypeItem,
} from '../../../core/models/models';
import { RealtimeService } from '../../../core/services/realtime.service';
import { formatInstantInTimeZone } from '../../../core/time/location-date';
import { ConfirmDialogService } from '../../../shared/ui/dialog/confirm-dialog.service';
import {
  CazoIconComponent,
} from '../../../shared/ui/cazo-icon/cazo-icon.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TabItem, TabsComponent } from '../../../shared/ui/tabs/tabs.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { NoticeComponent } from '../../../shared/ui/notice/notice.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ComboboxComponent, ComboboxOption } from '../../../shared/ui/combobox/combobox.component';
import { PosRoomsService } from './pos-rooms.service';

type RoomStatusFilter = number | null;
type RoomStatusTone = 'available' | 'occupied' | 'attention' | 'reserved' | 'out';
type RoomStayFine = RoomStayDetail['fines'][number];

interface StatusChip {
  readonly id: RoomStatusFilter;
  readonly label: string;
  readonly count: number;
}

@Component({
  selector: 'rms-pos-rooms-page',
  imports: [
    CazoIconComponent,
    FormsModule,
    PageHeaderComponent,
    TabsComponent,
    StatusBadgeComponent,
    NoticeComponent,
    EmptyStateComponent,
    ComboboxComponent,
  ],
  templateUrl: './pos-rooms-page.component.html',
  styleUrl: './pos-rooms-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosRoomsPageComponent implements OnInit {
  private readonly api = inject(PosRoomsService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly confirm = inject(ConfirmDialogService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly rows = signal<readonly RoomItem[]>([]);
  protected readonly floor = signal<number | 'all'>('all');
  protected readonly statusFilter = signal<RoomStatusFilter>(null);
  protected readonly searchText = signal('');

  protected readonly selectedRoom = signal<RoomItem | null>(null);
  protected readonly stayDetail = signal<RoomStayDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly panelError = signal<string | null>(null);
  protected readonly stayTab = signal<string>('cuenta');

  protected readonly stayTypes = signal<readonly ServiceStayTypeItem[]>([]);
  protected readonly fineTypes = signal<readonly FineTypeItem[]>([]);
  protected readonly activeSession = signal<CashSessionSummary | null>(null);

  // Check-in (habitación libre)
  protected readonly checkInArrival = signal<1 | 2>(1);
  protected readonly checkInCustomerName = signal('');
  protected readonly checkInVehiclePlate = signal('');
  protected readonly checkInStayTypeId = signal<number | null>(null);
  protected readonly checkInNotes = signal('');

  // Alta de multa (estancia ocupada)
  protected readonly fineTypeId = signal<number | null>(null);
  protected readonly fineDescription = signal('');
  protected readonly fineAmount = signal<number | null>(null);

  // Cobro (check-out)
  protected readonly paymentMethod = signal<'Efectivo' | 'Tarjeta'>('Efectivo');
  protected readonly paidAmountInput = signal<number | null>(null);

  protected readonly currencyCode = computed(() => this.session.session()?.tenant?.currencyCode || 'NIO');
  protected readonly timeZone = computed(() => this.session.session()?.tenant?.timeZone || 'America/Managua');
  protected readonly cashSessionOpen = computed(() => !!this.activeSession()?.cashBoxSessionId);

  /** La vista vive tras el guard de sesión; no exige permisos propios (no bloquea por defecto). */
  protected readonly canView = computed(() => !!this.session.session());
  protected readonly canManage = computed(() => this.session.hasPermission('service.rooms'));

  protected readonly floors = computed(() =>
    [...new Set(this.rows().map((room) => room.floorNumber).filter((floor) => Number.isSafeInteger(floor)))]
      .sort((a, b) => a - b),
  );
  protected readonly floorTabs = computed<readonly TabItem[]>(() => [
    { id: 'all', label: 'Todos', count: this.rows().length },
    ...this.floors().map((value) => ({
      id: String(value),
      label: `Piso ${value}`,
      count: this.rows().filter((room) => room.floorNumber === value).length,
    })),
  ]);
  protected readonly floorRows = computed(() => {
    const floor = this.floor();
    return this.rows().filter((room) => floor === 'all' || room.floorNumber === floor);
  });
  protected readonly statusChips = computed<readonly StatusChip[]>(() => [
    { id: null, label: 'Todas', count: this.floorRows().length },
    { id: 0, label: 'Libres', count: this.countByStatus(0) },
    { id: 1, label: 'Ocupadas', count: this.countByStatus(1) },
    { id: 2, label: 'Limpieza', count: this.countByStatus(2) },
    { id: 3, label: 'Mantenimiento', count: this.countByStatus(3) },
    { id: 4, label: 'Reservadas', count: this.countByStatus(4) },
  ]);
  protected readonly visibleRows = computed(() => {
    const status = this.statusFilter();
    const search = this.searchText().trim().toLowerCase();
    return this.floorRows().filter((room) => {
      if (status !== null && room.statusCode !== status) return false;
      if (!search) return true;
      return [room.roomNumber, room.customerName, room.vehiclePlate, room.roomTypeName]
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(search));
    });
  });
  protected readonly summary = computed(() => {
    const rows = this.floorRows();
    return {
      total: rows.length,
      free: this.countByStatus(0),
      occupied: this.countByStatus(1),
      cleaning: this.countByStatus(2),
      maintenance: this.countByStatus(3),
      reserved: this.countByStatus(4),
    };
  });

  protected readonly initialStayTypes = computed(() => {
    const types = this.stayTypes().filter((type) => !type.isExtension && type.isActive);
    return types.length > 0 ? types : this.stayTypes();
  });
  protected readonly extensionStayTypes = computed(() => {
    const types = this.stayTypes().filter((type) => type.isExtension && type.isActive);
    return types.length > 0 ? types : this.stayTypes();
  });
  protected readonly stayTypeOptions = computed<readonly ComboboxOption<number>[]>(() =>
    this.initialStayTypes().map((type) => ({
      value: type.serviceStayTypeId,
      label: `${type.name} · ${type.durationHours} h`,
      hint: `${this.money(type.price)} ${this.currencyCode()}`,
    })),
  );
  protected readonly extensionOptions = computed<readonly ComboboxOption<number>[]>(() =>
    this.extensionStayTypes().map((type) => ({
      value: type.serviceStayTypeId,
      label: `${type.name} · +${type.durationHours} h`,
      hint: `${this.money(type.price)} ${this.currencyCode()}`,
    })),
  );
  protected readonly fineTypeOptions = computed<readonly ComboboxOption<number | null>[]>(() => [
    { value: null, label: 'Personalizada…', hint: 'Escribe el motivo y el monto' },
    ...this.fineTypes().map((type) => ({
      value: type.fineTypeId,
      label: type.name,
      hint: `Monto sugerido ${this.money(type.defaultAmount)} ${this.currencyCode()}`,
    })),
  ]);

  protected readonly stayTabs = computed<readonly TabItem[]>(() => {
    const tabs: TabItem[] = [{ id: 'cuenta', label: 'Cuenta' }];
    if (this.canManage()) tabs.push({ id: 'extender', label: 'Extender' }, { id: 'multas', label: 'Multas', count: this.stayDetail()?.fines.length ?? null });
    tabs.push({ id: 'cobro', label: 'Cobro' });
    return tabs;
  });

  protected readonly selectedStayType = computed(() =>
    this.initialStayTypes().find((type) => type.serviceStayTypeId === this.checkInStayTypeId()) ?? null,
  );
  protected readonly extensionStayTypeId = signal<number | null>(null);
  protected readonly selectedExtensionType = computed(() =>
    this.extensionStayTypes().find((type) => type.serviceStayTypeId === this.extensionStayTypeId()) ?? null,
  );
  protected readonly bill = computed(() => {
    const stay = this.stayDetail()?.stay;
    if (!stay) return null;
    const balance = Math.max(0, stay.totalAmount - stay.paidAmount);
    return { stay, balance };
  });
  protected readonly changeDue = computed(() => {
    const bill = this.bill();
    const paid = this.paidAmountInput();
    if (!bill || paid === null) return null;
    const change = paid - bill.stay.totalAmount;
    return change > 0.0001 ? change : null;
  });

  @ViewChild('roomDetail') private roomDetail?: ElementRef<HTMLElement>;
  @ViewChild('detailClose') private detailClose?: ElementRef<HTMLButtonElement>;
  private detailReturnFocus: HTMLElement | null = null;
  private mapRequestId = 0;
  private detailRequestId = 0;

  private countByStatus(statusCode: number): number {
    return this.floorRows().filter((room) => room.statusCode === statusCode).length;
  }

  ngOnInit(): void {
    this.loadCatalogs();
    this.load();
    this.realtime.roomsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { if (this.network.online()) this.load(); });
    // Respaldo: sondeo cada 30 s por si el hub no está disponible.
    const poll = window.setInterval(() => { if (this.network.online()) this.load(); }, 30_000);
    this.destroyRef.onDestroy(() => window.clearInterval(poll));
  }

  @HostListener('document:keydown.escape')
  protected closeOpenDialog(): void {
    if (this.saving()) return;
    if (this.selectedRoom()) this.closeRoom();
  }

  // ── Carga ──────────────────────────────────────────────────────────────────
  protected load(): void {
    const requestId = ++this.mapRequestId;
    if (!this.network.online()) { this.loading.set(false); return; }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.rooms()
      .pipe(finalize(() => { if (requestId === this.mapRequestId) this.loading.set(false); }))
      .subscribe({
        next: (rows) => {
          if (requestId !== this.mapRequestId) return;
          this.rows.set(rows);
          const selected = this.selectedRoom();
          if (!selected) return;
          const current = rows.find((room) => room.roomId === selected.roomId) ?? null;
          if (!current) {
            this.clearDetail();
            this.selectedRoom.set(null);
            return;
          }
          this.selectedRoom.set(current);
          const stayId = current.currentRoomStayId ?? null;
          if (stayId && stayId !== (selected.currentRoomStayId ?? null)) this.loadStayDetail(stayId);
        },
        error: (error: unknown) => {
          if (requestId === this.mapRequestId) this.errorMessage.set(describeApiError(error));
        },
      });
  }

  private loadCatalogs(): void {
    this.api.stayTypes().pipe(catchError(() => of<ServiceStayTypeItem[]>([])))
      .subscribe((types) => {
        this.stayTypes.set(types);
        const first = types.find((type) => !type.isExtension) ?? types[0];
        if (first && this.checkInStayTypeId() === null) this.checkInStayTypeId.set(first.serviceStayTypeId);
        const extension = types.find((type) => type.isExtension);
        if (extension && this.extensionStayTypeId() === null) this.extensionStayTypeId.set(extension.serviceStayTypeId);
      });
    this.api.fineTypes().pipe(catchError(() => of<FineTypeItem[]>([]))).subscribe((types) => this.fineTypes.set(types));
    this.refreshCashSession();
  }

  private refreshCashSession(): void {
    this.api.activeCashSession().pipe(catchError(() => of(null))).subscribe((session) => this.activeSession.set(session));
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  protected onFloorTab(id: string): void {
    this.floor.set(id === 'all' ? 'all' : Number(id) || 'all');
  }

  protected selectStatus(id: RoomStatusFilter): void {
    this.statusFilter.set(id);
  }

  protected setSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  // ── Detalle de la habitación ───────────────────────────────────────────────
  protected selectRoom(room: RoomItem): void {
    this.detailReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selectedRoom.set(room);
    this.stayTab.set('cuenta');
    this.panelError.set(null);
    this.stayDetail.set(null);
    this.resetForms();
    if (room.statusCode === 1 && room.currentRoomStayId) this.loadStayDetail(room.currentRoomStayId);
    setTimeout(() => this.detailClose?.nativeElement.focus(), 0);
  }

  protected closeRoom(): void {
    this.detailRequestId++;
    this.selectedRoom.set(null);
    this.clearDetail();
    const returnFocus = this.detailReturnFocus;
    this.detailReturnFocus = null;
    setTimeout(() => { if (returnFocus?.isConnected) returnFocus.focus(); }, 0);
  }

  private clearDetail(): void {
    this.stayDetail.set(null);
    this.detailLoading.set(false);
    this.panelError.set(null);
  }

  private resetForms(): void {
    this.checkInArrival.set(1);
    this.checkInCustomerName.set('');
    this.checkInVehiclePlate.set('');
    this.checkInNotes.set('');
    this.fineTypeId.set(null);
    this.fineDescription.set('');
    this.fineAmount.set(null);
    this.paymentMethod.set('Efectivo');
    this.paidAmountInput.set(null);
    const first = this.initialStayTypes()[0];
    if (first) this.checkInStayTypeId.set(first.serviceStayTypeId);
  }

  protected loadStayDetail(roomStayId: number): void {
    const requestId = ++this.detailRequestId;
    this.detailLoading.set(true);
    this.panelError.set(null);
    this.api.stayDetail(roomStayId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        if (requestId === this.detailRequestId) this.detailLoading.set(false);
      }))
      .subscribe({
        next: (detail) => {
          if (requestId !== this.detailRequestId || this.selectedRoom()?.currentRoomStayId !== roomStayId) return;
          // El backend expone `header` (alias `stay`); normaliza para el modelo TS.
          const withHeader = detail as RoomStayDetail & { header?: RoomStayDetail['stay'] };
          const normalized: RoomStayDetail = { ...detail, stay: detail.stay ?? withHeader.header ?? detail.stay };
          this.stayDetail.set(normalized);
          const total = normalized?.stay?.totalAmount ?? 0;
          this.paidAmountInput.set(total > 0 && this.paidAmountInput() === null ? total : this.paidAmountInput());
        },
        error: (error: unknown) => {
          if (requestId === this.detailRequestId) this.panelError.set(describeApiError(error));
        },
      });
  }

  protected refreshStayDetail(): void {
    const roomStayId = this.selectedRoom()?.currentRoomStayId;
    if (roomStayId) this.loadStayDetail(roomStayId);
  }

  // ── Check-in ───────────────────────────────────────────────────────────────
  protected setStayTypeId(value: number | null): void {
    this.checkInStayTypeId.set(value);
  }

  protected submitCheckIn(): void {
    const room = this.selectedRoom();
    if (!room || this.saving() || !this.canManage()) return;
    if (this.checkInArrival() === 2 && this.checkInVehiclePlate().trim().length === 0) {
      this.panelError.set('Para clientes en vehículo escribe la placa.');
      return;
    }
    if (this.checkInStayTypeId() === null) {
      this.panelError.set('Selecciona la tarifa del servicio.');
      return;
    }
    this.saving.set(true);
    this.panelError.set(null);
    this.api.startStay({
      roomId: room.roomId,
      customerName: this.checkInCustomerName().trim() || null,
      arrivalType: this.checkInArrival(),
      vehiclePlate: this.checkInArrival() === 2 ? this.checkInVehiclePlate().trim() : null,
      serviceStayTypeId: this.checkInStayTypeId() as number,
      notes: this.checkInNotes().trim() || null,
      cashBoxSessionId: this.activeSession()?.cashBoxSessionId ?? null,
    }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (roomStayId) => {
          this.closeRoom();
          this.successMessage.set(`Servicio iniciado en la habitación ${room.roomNumber} (estancia #${roomStayId}).`);
          this.load();
          this.refreshCashSession();
        },
        error: (error: unknown) => this.panelError.set(describeApiError(error)),
      });
  }

  // ── Extensión ──────────────────────────────────────────────────────────────
  protected setExtensionStayTypeId(value: number | null): void {
    this.extensionStayTypeId.set(value);
  }

  protected submitExtension(): void {
    const roomStayId = this.selectedRoom()?.currentRoomStayId;
    const stayTypeId = this.extensionStayTypeId();
    if (!roomStayId || !stayTypeId || this.saving() || !this.canManage()) return;
    this.saving.set(true);
    this.panelError.set(null);
    this.api.extendStay(roomStayId, stayTypeId)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Estancia extendida.');
          this.load();
          this.loadStayDetail(roomStayId);
        },
        error: (error: unknown) => this.panelError.set(describeApiError(error)),
      });
  }

  // ── Multas ─────────────────────────────────────────────────────────────────
  protected setFineType(value: number | null): void {
    this.fineTypeId.set(value);
    const preset = this.fineTypes().find((type) => type.fineTypeId === value);
    if (preset) {
      this.fineDescription.set(preset.name);
      if (this.fineAmount() === null || this.fineAmount() === 0) this.fineAmount.set(preset.defaultAmount);
    }
  }

  protected setFineAmountFromInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.fineAmount.set(raw === '' ? null : Number(raw));
  }

  protected submitFine(): void {
    const roomStayId = this.selectedRoom()?.currentRoomStayId;
    if (!roomStayId || this.saving() || !this.canManage()) return;
    const description = this.fineDescription().trim();
    const amount = this.fineAmount();
    if (description.length === 0) { this.panelError.set('Describe el motivo de la multa.'); return; }
    if (amount === null || amount <= 0) { this.panelError.set('El monto de la multa debe ser mayor a 0.'); return; }
    this.saving.set(true);
    this.panelError.set(null);
    this.api.addFine(roomStayId, {
      fineTypeId: this.fineTypeId(),
      description,
      amount,
      currencyCode: this.currencyCode() || 'NIO',
    }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Multa cargada a la cuenta.');
          this.load();
          this.loadStayDetail(roomStayId);
          this.fineDescription.set('');
          this.fineAmount.set(null);
          this.fineTypeId.set(null);
        },
        error: (error: unknown) => this.panelError.set(describeApiError(error)),
      });
  }

  protected async waiveFine(fine: RoomStayFine): Promise<void> {
    const roomStayId = this.selectedRoom()?.currentRoomStayId;
    if (!roomStayId || this.saving() || !this.canManage() || fine.isWaived) return;
    const accepted = await this.confirm.ask({
      title: 'Anular multa',
      detail: fine.description,
      message: 'La multa dejará de sumarse a la cuenta de la estancia.',
      confirmLabel: 'Anular multa',
      cancelLabel: 'Conservar',
      tone: 'warning',
      icon: 'trash',
    });
    if (!accepted) return;
    this.saving.set(true);
    this.panelError.set(null);
    this.api.waiveFine(fine.fineId, 'Anulada desde el POS de habitaciones')
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Multa anulada.');
          this.load();
          this.loadStayDetail(roomStayId);
        },
        error: (error: unknown) => this.panelError.set(describeApiError(error)),
      });
  }

  // ── Check-out ──────────────────────────────────────────────────────────────
  protected setPaidAmountFromInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.paidAmountInput.set(raw === '' ? null : Number(raw));
  }

  protected submitCheckout(): void {
    const room = this.selectedRoom();
    const roomStayId = room?.currentRoomStayId;
    const bill = this.bill();
    if (!roomStayId || !bill || this.saving() || !this.canManage()) return;
    const paid = this.paidAmountInput();
    if (paid === null || paid <= 0) {
      this.panelError.set('El monto pagado debe ser mayor a 0.');
      return;
    }
    this.saving.set(true);
    this.panelError.set(null);
    this.api.checkout(roomStayId, {
      paidAmount: paid,
      paymentMethod: this.paymentMethod(),
      cashBoxSessionId: this.activeSession()?.cashBoxSessionId ?? null,
    }).pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.closeRoom();
          this.successMessage.set(`Check-out completado: habitación ${room?.roomNumber} queda libre.`);
          this.load();
          this.refreshCashSession();
        },
        error: (error: unknown) => this.panelError.set(describeApiError(error)),
      });
  }

  // ── Limpieza ───────────────────────────────────────────────────────────────
  protected finishCleaning(): void {
    const room = this.selectedRoom();
    if (!room || this.saving() || !this.canManage()) return;
    this.saving.set(true);
    this.panelError.set(null);
    this.api.finishCleaning(room.roomId)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.closeRoom();
          this.successMessage.set(`Limpieza terminada en la habitación ${room.roomNumber}.`);
          this.load();
        },
        error: (error: unknown) => this.panelError.set(describeApiError(error)),
      });
  }

  // ── Ayudantes de presentación ──────────────────────────────────────────────
  protected statusTone(room: RoomItem): RoomStatusTone {
    switch (room.statusCode) {
      case 0: return 'available';
      case 1: return 'occupied';
      case 2: return 'attention';
      case 3: return 'out';
      default: return 'reserved';
    }
  }

  protected badgeTone(room: RoomItem): 'success' | 'ink' | 'warning' | 'neutral' | 'info' {
    switch (room.statusCode) {
      case 0: return 'success';
      case 1: return 'ink';
      case 2: return 'warning';
      case 3: return 'neutral';
      default: return 'info';
    }
  }

  protected money(value: number | null | undefined): string {
    return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(value ?? 0);
  }

  protected instant(value: string | null | undefined, style: 'short' | 'time' = 'short'): string {
    return value ? formatInstantInTimeZone(value, this.timeZone(), style) : '—';
  }

  protected elapsed(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined || minutes < 0) return '—';
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
  }

  protected stayTime(room: RoomItem): string {
    if (room.elapsedMinutes !== undefined && room.elapsedMinutes !== null) return this.elapsed(room.elapsedMinutes);
    if (room.startTimeUtc) return `desde ${this.instant(room.startTimeUtc, 'time')}`;
    return '—';
  }

  protected roomNote(room: RoomItem): string {
    switch (room.statusCode) {
      case 0: return 'Lista para iniciar el servicio';
      case 1: return room.customerName ? `Huésped: ${room.customerName}` : 'Huésped anónimo';
      case 2: return 'Pendiente de terminar limpieza';
      case 3: return 'No disponible hasta nuevo aviso';
      case 4: return 'Reservada para llegada';
      default: return room.statusName;
    }
  }

  protected dismissMessages(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }
}
