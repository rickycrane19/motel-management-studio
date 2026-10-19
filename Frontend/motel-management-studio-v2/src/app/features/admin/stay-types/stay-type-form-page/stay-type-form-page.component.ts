import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { ServiceStayType } from '../../../../core/models/service/catalog.model';
import { CatalogService } from '../../../../core/services/service/catalog.service';
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
  ToastService,
} from '../../../../shared/ui';

@Component({
  selector: 'rms-stay-type-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, EmptyStateComponent, FieldComponent, FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './stay-type-form-page.component.html',
  styleUrl: './stay-type-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StayTypeFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly catalogService = inject(CatalogService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly stayTypeId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.stayTypeId !== null;
  protected readonly backLink = '/admin/stay-types';

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly dirty = signal(false);
  /** Se incrementa con cada cambio del formulario para refrescar lo que depende de su validez. */
  private readonly tick = signal(0);

  // Lo que se muestra en la vista previa mientras se llena el formulario.
  protected readonly nameValue = signal('');
  protected readonly durationValue = signal(2);
  protected readonly priceValue = signal(0);
  protected readonly isExtensionValue = signal(false);
  protected readonly isActiveValue = signal(true);

  protected readonly roomTypes = signal<readonly ComboboxOption<number>[]>([]);

  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    roomTypeId: this.formBuilder.control<number | null>(null),
    durationHours: this.formBuilder.nonNullable.control(2, [Validators.required, Validators.min(0.5), Validators.max(720)]),
    price: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0), Validators.pattern(/^\d{1,14}(?:\.\d{1,4})?$/)]),
    isExtension: this.formBuilder.nonNullable.control(false),
    isActive: this.formBuilder.nonNullable.control(true),
  });

  protected readonly pricePerHour = computed(() => {
    this.tick();
    const hours = Number(this.form.controls.durationHours.value);
    const price = Number(this.form.controls.price.value);
    return hours > 0 ? price / hours : 0;
  });

  protected readonly roomTypeName = computed(() => {
    this.tick();
    const roomTypeId = this.form.controls.roomTypeId.value;
    if (roomTypeId === null) return 'Todo el motel';
    return this.roomTypes().find((roomType) => roomType.value === roomTypeId)?.label ?? 'Tipo de cuarto';
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncSignals(true));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const roomTypes$: Observable<readonly ComboboxOption<number>[]> = this.catalogService.listRoomTypes().pipe(
      catchError(() => of<readonly { id: number; name: string }[]>([])),
      map((roomTypes) => roomTypes.map((roomType): ComboboxOption<number> => ({ value: roomType.id, label: roomType.name }))),
    );
    const stayType$: Observable<ServiceStayType | null> = this.stayTypeId !== null
      ? this.catalogService.getStayTypeById(this.stayTypeId).pipe(catchError((error: unknown) => { this.loadError.set(describeApiError(error)); return of<ServiceStayType | null>(null); }))
      : of<ServiceStayType | null>(null);
    forkJoin({ roomTypes: roomTypes$, stayType: stayType$ })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ roomTypes, stayType }) => {
        this.roomTypes.set(roomTypes);
        if (this.stayTypeId !== null) {
          if (!stayType) {
            if (!this.loadError()) this.loadError.set('No encontramos esta tarifa. Vuelve al listado y revisa.');
            return;
          }
          this.applyStayType(stayType);
        }
        this.syncSignals(false);
      });
  }

  private applyStayType(stayType: ServiceStayType): void {
    this.form.reset({
      name: stayType.name,
      roomTypeId: stayType.roomTypeId,
      durationHours: stayType.durationHours,
      price: stayType.price,
      isExtension: stayType.isExtension,
      isActive: stayType.isActive,
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
  }

  private syncSignals(markDirty: boolean): void {
    this.tick.update((value) => value + 1);
    const controls = this.form.controls;
    this.nameValue.set(controls.name.value);
    this.durationValue.set(Number(controls.durationHours.value) || 0);
    this.priceValue.set(Number(controls.price.value) || 0);
    this.isExtensionValue.set(controls.isExtension.value);
    this.isActiveValue.set(controls.isActive.value);
    if (markDirty) this.dirty.set(true);
  }

  // ── Textos de ayuda y errores ────────────────────────────────────────────────────────────

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe el nombre de la tarifa.';
    if (control.hasError('maxlength')) return 'Usa 100 letras o menos.';
    return null;
  }

  protected durationError(): string | null {
    const control = this.form.controls.durationHours;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe cuántas horas incluye la tarifa.';
    if (control.hasError('min')) return 'Mínimo media hora (0.5).';
    if (control.hasError('max')) return 'Máximo 720 horas (30 días).';
    return null;
  }

  protected priceError(): string | null {
    const control = this.form.controls.price;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe el precio de la tarifa.';
    return control.invalid ? 'Escribe el precio con números, por ejemplo 350 o 350.50.' : null;
  }

  protected money(amount: number): string {
    try {
      return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', currencyDisplay: 'narrowSymbol' }).format(amount);
    } catch {
      return `C$ ${amount.toFixed(2)}`;
    }
  }

  protected toNumber(value: unknown): number {
    return Number(value) || 0;
  }

  protected durationLabel(hours: number): string {
    const rounded = Number.isInteger(hours) ? hours : hours.toFixed(1);
    return `${rounded} ${hours === 1 ? 'hora' : 'horas'}`;
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
    if (this.saving() || !this.network.online() || !this.session.hasPermission('service.stay-types')) return;
    this.saveError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const name = value.name.trim();
    const payload = {
      id: this.stayTypeId,
      roomTypeId: value.roomTypeId ?? null,
      name,
      durationHours: Number(value.durationHours),
      price: Number(value.price),
      isExtension: value.isExtension,
      isActive: value.isActive,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = payload.id !== null
      ? this.catalogService.updateStayType({ ...payload, id: payload.id })
      : this.catalogService.createStayType(payload);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dirty.set(false);
        this.toast.success(this.isEdit ? 'Tarifa actualizada' : 'Tarifa creada', name);
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error: unknown) => {
        this.saveError.set(describeApiError(error));
      },
    });
  }
}
