import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import {
  ActiveLossCashSession,
  LOSS_CATEGORY_LABELS,
  LossCategoryCode,
  RecordFinancialLossInput,
} from '../../../../core/models/finance/losses.model';
import { LossesService } from '../../../../core/services/finance/reports.service';
import { RoomService } from '../../../../core/services/service/room.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxLoader,
  ComboboxOption,
  FieldComponent,
  FieldGroupComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  ToastService,
} from '../../../../shared/ui';
import { LOSS_CATEGORIES } from '../losses.store';

/**
 * Registro de una pérdida del negocio (daño de cuarto, minibar, faltante de caja u otro).
 * El registro es inmutable: si el error fue de captura, se compensa con otra pérdida o un ajuste.
 */
@Component({
  selector: 'rms-loss-register-page',
  imports: [
    ReactiveFormsModule, RouterLink, DecimalPipe, CazoIconComponent, ComboboxComponent, FieldComponent,
    FieldGroupComponent, FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './loss-register-page.component.html',
  styleUrl: './loss-register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LossRegisterPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly losses = inject(LossesService);
  private readonly rooms = inject(RoomService);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly backLink = '/admin/losses';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activeSession = signal<ActiveLossCashSession | null>(null);
  protected readonly loadingSession = signal(true);
  protected readonly deductFromCash = signal(false);
  protected readonly selectedRoomOption = signal<readonly ComboboxOption<number>[]>([]);
  private readonly tick = signal(0);

  protected readonly categories = LOSS_CATEGORIES;
  protected readonly categoryLabels = LOSS_CATEGORY_LABELS;

  protected readonly canRegister = computed(
    () => this.session.hasPermission('finance:manage-cashbox') || this.session.hasPermission('finance.reports'),
  );
  protected readonly currencyCode = computed(() => (this.session.session()?.tenant.currencyCode || 'NIO').trim().toUpperCase());

  protected readonly form = this.formBuilder.group({
    categoryCode: this.formBuilder.control<LossCategoryCode | null>(null),
    roomId: this.formBuilder.control<number | null>(null),
    amount: this.formBuilder.control<number | null>(null),
    description: this.formBuilder.control<string>(''),
  });

  protected readonly categoryCode = computed<LossCategoryCode | null>(() => {
    this.tick();
    return this.form.controls.categoryCode.value;
  });
  protected readonly amount = computed<number>(() => {
    this.tick();
    return this.form.controls.amount.value ?? 0;
  });
  protected readonly description = computed<string>(() => {
    this.tick();
    return (this.form.controls.description.value ?? '').trim();
  });

  protected readonly categoryError = computed<string | null>(() => {
    if (!this.categoryCode() && !this.form.controls.categoryCode.touched) return null;
    return this.categoryCode() ? null : 'Elige qué tipo de pérdida fue.';
  });
  protected readonly amountError = computed<string | null>(() => {
    this.tick();
    if (!this.form.controls.amount.touched && this.amount() === 0) return null;
    return this.amount() > 0 ? null : 'Escribe un monto mayor que cero.';
  });
  protected readonly descriptionError = computed<string | null>(() => {
    this.tick();
    if (!this.form.controls.description.touched && !this.description()) return null;
    return this.description().length >= 5 ? null : 'Cuenta brevemente qué pasó (mínimo 5 letras).';
  });

  protected readonly canSave = computed(() =>
    !!this.categoryCode() && this.amount() > 0 && this.description().length >= 5 && !this.saving());

  protected readonly searchRooms: ComboboxLoader<number> = (term) => this.rooms
    .list({
      pageNumber: 1,
      pageSize: 20,
      search: term.trim(),
      roomTypeId: null,
      floor: null,
      physicalStatus: 'all',
      activity: 'active',
    })
    .pipe(map((page) => page.items.map((room) => ({
      value: room.roomId,
      label: `Cuarto ${room.roomNumber}`,
      hint: [room.roomTypeName, room.statusName].filter(Boolean).join(' · ') || undefined,
    }))));

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.tick.update((value) => value + 1));

    if (!this.canRegister()) {
      this.loadingSession.set(false);
      return;
    }

    // ¿Hay caja abierta para descontar la pérdida del efectivo del turno?
    this.losses.activeSession()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingSession.set(false)))
      .subscribe({
        next: (active) => this.activeSession.set(active),
        error: () => this.activeSession.set(null),
      });
  }

  protected chooseCategory(code: LossCategoryCode): void {
    this.form.controls.categoryCode.setValue(this.categoryCode() === code ? null : code);
    this.tick.update((value) => value + 1);
  }

  protected lossHint(code: LossCategoryCode): string {
    switch (code) {
      case 'Habitacion': return 'Daño o deterioro de un cuarto';
      case 'Minibar': return 'Producto perdido, vencido o no cobrado';
      case 'Caja': return 'Faltante de efectivo del turno';
      default: return 'Otra pérdida del negocio';
    }
  }

  protected roomPicked(option: ComboboxOption<number> | null): void {
    if (!option) {
      this.selectedRoomOption.set([]);
      this.form.patchValue({ roomId: null });
      return;
    }
    this.selectedRoomOption.set([option]);
    this.form.patchValue({ roomId: option.value });
  }

  protected toggleDeduct(event: Event): void {
    this.deductFromCash.set((event.target as HTMLInputElement).checked);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    this.tick.update((value) => value + 1);
    if (this.saving() || !this.network.online()) return;
    if (!this.canSave()) {
      if (!this.categoryCode()) this.error.set(this.categoryError());
      else if (this.amount() <= 0) this.error.set(this.amountError());
      else this.error.set(this.descriptionError());
      return;
    }

    const active = this.activeSession();
    const payload: RecordFinancialLossInput = {
      categoryCode: this.categoryCode()!,
      description: this.description().slice(0, 300),
      amount: this.amount(),
      currencyCode: this.currencyCode(),
      roomId: this.form.controls.roomId.value ?? null,
      roomStayId: null,
      cashBoxSessionId: this.deductFromCash() && active ? active.cashBoxSessionId : null,
    };

    this.saving.set(true);
    this.error.set(null);
    this.losses.record(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(
            'Pérdida registrada',
            this.deductFromCash() && active
              ? 'Se descontó del efectivo del turno.'
              : 'Quedó registrada solo en reportes.',
          );
          void this.router.navigateByUrl(this.backLink);
        },
        error: (error: unknown) => this.error.set(describeApiError(error)),
      });
  }
}
