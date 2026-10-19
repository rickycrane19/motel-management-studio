import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { Observable } from 'rxjs';
import { catchError, finalize, forkJoin } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { Room } from '../../../../core/models/service/room.model';
import { RoomService, RoomType } from '../../../../core/services/service/room.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  EmptyStateComponent,
  FieldComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  StatusBadgeComponent,
  StepItem,
  ToastService,
} from '../../../../shared/ui';

@Component({
  selector: 'rms-room-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, EmptyStateComponent, FieldComponent,
    FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './room-form-page.component.html',
  styleUrl: './room-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly roomsService = inject(RoomService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly roomId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.roomId !== null;
  protected readonly backLink = '/admin/rooms';

  protected readonly step = signal(0);
  protected readonly reached = signal(0);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly dirty = signal(false);
  /** Se incrementa con cada cambio del formulario para refrescar lo que depende de su validez. */
  private readonly tick = signal(0);
  /** Pasos donde la persona ya intentó avanzar: solo ahí se marca el error en el paso. */
  private readonly attempted = signal<ReadonlySet<number>>(new Set());

  // Lo que se muestra en la vista previa y en el resumen.
  protected readonly numberValue = signal('');
  protected readonly notesValue = signal('');
  protected readonly typeLabel = signal('');
  protected readonly floorValue = signal(1);
  protected readonly isActiveValue = signal(true);

  protected readonly current = signal<Room | null>(null);
  protected readonly roomTypes = signal<readonly ComboboxOption<number>[]>([]);

  protected readonly form = this.formBuilder.group({
    roomNumber: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(20)]),
    roomTypeId: this.formBuilder.control<number | null>(null, Validators.required),
    floorNumber: this.formBuilder.nonNullable.control(1, [Validators.required, Validators.min(1), Validators.max(200)]),
    notes: this.formBuilder.nonNullable.control('', Validators.maxLength(200)),
    isActive: this.formBuilder.nonNullable.control(true),
  });

  protected readonly steps = computed<readonly StepItem[]>(() => {
    this.tick();
    return [
      { id: 'identidad', label: 'Identidad', description: 'Número, tipo y piso', invalid: this.stepInvalid(0) },
      { id: 'notas', label: 'Notas', description: 'Indicaciones para el personal', invalid: this.stepInvalid(1) },
      { id: 'publicacion', label: 'Publicación', description: 'Revisa y habilita', invalid: this.stepInvalid(2) },
    ];
  });
  protected readonly lastStep = computed(() => this.steps().length - 1);

  protected readonly readiness = computed(() => {
    this.tick();
    const controls = this.form.controls;
    return [
      { label: 'Número, tipo y piso', done: controls.roomNumber.valid && controls.roomTypeId.valid && controls.floorNumber.valid, step: 0 },
      { label: 'Notas para el personal (opcional)', done: controls.notes.value.trim().length > 0, step: 1, optional: true },
      { label: 'Estado de publicación decidido', done: true, step: 2, optional: true },
    ];
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncSignals(true));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      roomTypes: this.roomsService.listRoomTypes().pipe(catchError(() => of([] as readonly RoomType[]))),
      room: this.roomId !== null
        ? this.roomsService.getById(this.roomId).pipe(catchError((error: unknown) => { this.loadError.set(describeApiError(error)); return of(null); }))
        : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ roomTypes, room }) => {
        this.roomTypes.set(roomTypes.map((type) => ({ value: type.roomTypeId, label: type.name })));
        if (this.roomId !== null) {
          if (!room) { if (!this.loadError()) this.loadError.set('No encontramos esta habitación. Vuelve al listado y revisa.'); return; }
          this.applyRoom(room);
        } else {
          this.form.patchValue({ floorNumber: 1, notes: '', isActive: true }, { emitEvent: false });
          this.form.markAsPristine();
          this.dirty.set(false);
        }
        this.syncSignals(false);
      });
  }

  private applyRoom(room: Room): void {
    this.current.set(room);
    this.form.reset({
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      floorNumber: room.floorNumber,
      notes: room.notes ?? '',
      isActive: room.isActive,
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
    this.reached.set(this.lastStep());
  }

  private syncSignals(markDirty: boolean): void {
    this.tick.update((value) => value + 1);
    const controls = this.form.controls;
    this.numberValue.set(controls.roomNumber.value);
    this.notesValue.set(controls.notes.value);
    this.floorValue.set(Math.max(1, Math.round(Number(controls.floorNumber.value) || 1)));
    this.isActiveValue.set(controls.isActive.value);
    const selected = this.roomTypes().find((type) => type.value === controls.roomTypeId.value);
    this.typeLabel.set(selected?.label ?? '');
    if (markDirty) this.dirty.set(true);
  }

  protected numberError(): string | null {
    const control = this.form.controls.roomNumber;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe el número o nombre con el que se conoce la habitación.';
    if (control.hasError('maxlength')) return 'Usa 20 caracteres o menos.';
    return null;
  }

  protected typeError(): string | null {
    const control = this.form.controls.roomTypeId;
    return control.touched && control.invalid ? 'Elige el tipo de la habitación.' : null;
  }

  protected floorError(): string | null {
    const control = this.form.controls.floorNumber;
    if (!control.touched && !control.dirty) return null;
    return control.invalid ? 'Escribe el piso con un número de 1 para arriba.' : null;
  }

  // ── Navegación entre pasos ───────────────────────────────────────────────────────────────
  protected stepInvalid(index: number): boolean {
    if (!this.attempted().has(index)) return false;
    const controls = this.form.controls;
    if (index === 0) return controls.roomNumber.invalid || controls.roomTypeId.invalid || controls.floorNumber.invalid;
    if (index === 1) return controls.notes.invalid;
    return false;
  }

  protected goTo(index: number): void {
    if (index <= this.reached()) this.step.set(index);
  }

  protected next(): void {
    if (!this.validateStep(this.step())) return;
    const target = Math.min(this.step() + 1, this.lastStep());
    this.step.set(target);
    this.reached.update((value) => Math.max(value, target));
  }

  protected previous(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected jump(step: number): void {
    this.step.set(step);
  }

  private validateStep(step: number): boolean {
    this.saveError.set(null);
    this.attempted.update((set) => new Set(set).add(step));
    const controls = this.form.controls;
    if (step === 0) {
      [controls.roomNumber, controls.roomTypeId, controls.floorNumber].forEach((control) => control.markAsTouched());
      return !(controls.roomNumber.invalid || controls.roomTypeId.invalid || controls.floorNumber.invalid);
    }
    if (step === 1) {
      controls.notes.markAsTouched();
      if (controls.notes.invalid) return false;
    }
    return true;
  }

  protected async cancel(): Promise<void> {
    if (this.dirty() && !this.saving()) {
      const leave = await this.confirm.ask({
        title: 'Salir sin guardar',
        message: 'Hiciste cambios que todavía no se guardaron. Si sales, se pierden.',
        confirmLabel: 'Salir sin guardar',
        cancelLabel: 'Seguir editando',
        tone: 'warning',
      });
      if (!leave) return;
    }
    void this.router.navigateByUrl(this.backLink);
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────────────────
  protected save(): void {
    if (this.saving() || !this.network.online()) return;
    this.saveError.set(null);
    this.form.markAllAsTouched();
    if (!this.validateStep(0)) { this.step.set(0); return; }
    if (!this.validateStep(1)) { this.step.set(1); return; }
    const value = this.form.getRawValue();
    const payload = {
      id: this.roomId,
      roomNumber: value.roomNumber.trim(),
      roomTypeId: Number(value.roomTypeId),
      floorNumber: Math.max(1, Math.round(Number(value.floorNumber) || 1)),
      notes: value.notes.trim() ? value.notes.trim() : null,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = this.isEdit && this.roomId !== null
      ? this.roomsService.update({ roomNumber: payload.roomNumber, roomTypeId: payload.roomTypeId, floorNumber: payload.floorNumber, notes: payload.notes, id: this.roomId })
      : this.roomsService.create(payload);
    // Al editar, el estado de publicación viaja aparte, como en el POS.
    const publishAfter = (): void => {
      if (this.isEdit && this.roomId !== null && this.current() !== null && this.current()!.isActive !== value.isActive) {
        this.roomsService.setActive(this.roomId, value.isActive).subscribe({
          next: () => this.onSaved(payload.roomNumber),
          error: (error: unknown) => {
            this.roomsService.invalidateCache();
            this.saving.set(false);
            this.saveError.set(describeApiError(error));
          },
        });
        return;
      }
      this.onSaved(payload.roomNumber);
    };
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => publishAfter(),
      error: (error: unknown) => {
        this.saveError.set(describeApiError(error));
      },
    });
  }

  private onSaved(roomNumber: string): void {
    this.dirty.set(false);
    this.roomsService.invalidateCache();
    this.saving.set(false);
    this.toast.success(this.isEdit ? 'Habitación actualizada' : 'Habitación creada', `Habitación ${roomNumber}`);
    void this.router.navigateByUrl(this.backLink);
  }
}
