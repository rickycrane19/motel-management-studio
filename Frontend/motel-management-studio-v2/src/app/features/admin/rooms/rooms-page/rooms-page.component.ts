import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import {
  Room,
  RoomPhysicalStatus,
  ROOM_STATUS_CODES,
  roomEquipment,
} from '../../../../core/models/service/room.model';
import { RoomService, RoomType } from '../../../../core/services/service/room.service';
import { csvDocument } from '../../../../shared/export/safe-csv';
import {
  CazoIconComponent,
  CazoIconName,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DrawerComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { RoomsStore } from '../rooms.store';

type ActivityFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'rms-rooms-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, DataTableComponent, DataTableCellDirective,
    DrawerComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [RoomsStore],
  templateUrl: './rooms-page.component.html',
  styleUrl: './rooms-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomsPageComponent implements OnInit {
  protected readonly store = inject(RoomsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roomsService = inject(RoomService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly roomTypes = signal<readonly ComboboxOption<number>[]>([]);
  protected readonly floors = signal<readonly ComboboxOption<number>[]>([]);
  protected readonly selected = signal<Room | null>(null);
  protected readonly typeControl = new FormControl<number | null>(null);
  protected readonly floorControl = new FormControl<number | null>(null);
  protected readonly physicalControl = new FormControl<RoomPhysicalStatus>('all', { nonNullable: true });
  protected readonly activityControl = new FormControl<ActivityFilter>('all', { nonNullable: true });
  protected readonly physicalOptions: readonly ComboboxOption<RoomPhysicalStatus>[] = [
    { value: 'all', label: 'Cualquier estado físico' },
    { value: 'available', label: 'Disponibles' },
    { value: 'occupied', label: 'Ocupadas' },
    { value: 'cleaning', label: 'En limpieza' },
    { value: 'maintenance', label: 'En mantenimiento' },
  ];
  protected readonly activityOptions: readonly ComboboxOption<ActivityFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Habilitadas' },
    { value: 'inactive', label: 'Deshabilitadas' },
  ];
  protected readonly pageSizes = [10, 20, 50] as const;
  protected readonly trackRoom = (row: Room): number => row.roomId;

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'room', label: 'Habitación' },
    { key: 'type', label: 'Tipo y piso' },
    { key: 'status', label: 'Estado físico', width: '150px' },
    { key: 'activity', label: 'Estado', width: '130px' },
    { key: 'actions', label: '', width: '110px', align: 'end' },
  ];

  protected readonly canCreate = computed(() => this.session.hasPermission('service:manage'));
  protected readonly canUpdate = computed(() => this.session.hasPermission('service:manage'));
  protected readonly activeFilters = computed(() => {
    const query = this.store.query();
    return (query.roomTypeId !== null ? 1 : 0) + (query.floor !== null ? 1 : 0)
      + (query.physicalStatus !== 'all' ? 1 : 0) + (query.activity !== 'all' ? 1 : 0);
  });
  protected readonly tableError = computed(() => (this.store.status() === 'error' ? this.store.errorMessage() : null));

  ngOnInit(): void {
    this.roomsService.listRoomTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (types) => this.roomTypes.set(types.map((type) => ({ value: type.roomTypeId, label: type.name }))),
      error: () => this.toast.warning('No pudimos cargar los tipos de habitación', 'El filtro por tipo no está disponible por ahora.'),
    });
    this.roomsService.listFloors().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (floors) => this.floors.set(floors.map((floor) => ({ value: floor, label: `Piso ${floor}` }))),
      error: () => this.floors.set([]),
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.store.load({ search: params.get('search')?.trim() ?? '', pageNumber: 1 });
    });
    this.typeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.floorControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.physicalControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.activityControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ ...this.currentFilters(), search: term });
  }

  protected clearFilters(): void {
    this.typeControl.setValue(null, { emitEvent: false });
    this.floorControl.setValue(null, { emitEvent: false });
    this.physicalControl.setValue('all', { emitEvent: false });
    this.activityControl.setValue('all', { emitEvent: false });
    this.store.resetFilters();
  }

  private applyFilters(): void {
    this.store.applyFilters(this.currentFilters());
  }

  private currentFilters() {
    return {
      search: this.store.query().search,
      roomTypeId: this.typeControl.value,
      floor: this.floorControl.value,
      physicalStatus: this.physicalControl.value,
      activity: this.activityControl.value,
    };
  }

  protected setPageSize(size: number): void {
    this.store.load({ pageSize: size, pageNumber: 1 });
  }

  protected open(room: Room): void {
    this.selected.set(room);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected async toggleStatus(room: Room): Promise<void> {
    if (!this.network.online()) return;
    const disabling = room.isActive;
    const accepted = await this.confirm.ask({
      title: disabling ? 'Deshabilitar habitación' : 'Rehabilitar habitación',
      message: disabling
        ? 'Dejará de aparecer en el monitor de habitaciones y en el POS. No se borra: puedes rehabilitarla cuando quieras.'
        : 'Volverá a aparecer en el monitor de habitaciones de tu motel.',
      detail: `Habitación ${room.roomNumber}`,
      confirmLabel: disabling ? 'Deshabilitar' : 'Rehabilitar',
      tone: disabling ? 'warning' : 'primary',
    });
    if (!accepted) return;
    this.store.setActive(room, !disabling).subscribe((done) => {
      if (!done) { this.toast.error('No se pudo cambiar el estado', this.store.errorMessage() ?? 'Inténtalo de nuevo en unos segundos.'); return; }
      this.toast.success(disabling ? 'Habitación deshabilitada' : 'Habitación habilitada', `Habitación ${room.roomNumber}`);
      this.selected.set(null);
    });
  }

  protected statusIcon(room: Room): CazoIconName {
    switch (room.statusCode) {
      case 0: return 'check';
      case 1: return 'users';
      case 2: return 'sparkles';
      case 3: return 'alert';
      default: return 'calendar';
    }
  }

  protected statusTone(room: Room): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (room.statusCode) {
      case 0: return 'success';
      case 1: return 'warning';
      case 2: return 'warning';
      case 3: return 'danger';
      default: return 'neutral';
    }
  }

  protected equipment(room: Room): string {
    return roomEquipment(room);
  }

  protected floorLabel(room: Room): string {
    return `Piso ${room.floorNumber}`;
  }

  protected statusName(room: Room): string {
    return ROOM_STATUS_CODES[room.statusCode] ?? room.statusName;
  }

  protected exportCurrentPage(): void {
    const columns = ['Habitación', 'Tipo', 'Piso', 'Estado físico', 'Estado'];
    const rows = this.store.rooms().map((room) => [
      room.roomNumber, room.roomTypeName, room.floorNumber, this.statusName(room), room.isActive ? 'Habilitada' : 'Deshabilitada',
    ]);
    const url = URL.createObjectURL(new Blob([csvDocument([columns, ...rows])], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `habitaciones-pagina-${this.store.query().pageNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
