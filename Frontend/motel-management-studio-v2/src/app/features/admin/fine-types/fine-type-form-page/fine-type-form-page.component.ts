import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { FineType } from '../../../../core/models/service/catalog.model';
import { CatalogService } from '../../../../core/services/service/catalog.service';
import {
  CazoIconComponent,
  ConfirmDialogService,
  EmptyStateComponent,
  FieldComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  ToastService,
} from '../../../../shared/ui';

@Component({
  selector: 'rms-fine-type-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, EmptyStateComponent, FieldComponent, FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './fine-type-form-page.component.html',
  styleUrl: './fine-type-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FineTypeFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly catalogService = inject(CatalogService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly fineTypeId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.fineTypeId !== null;
  protected readonly backLink = '/admin/fine-types';

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly dirty = signal(false);

  // Lo que se muestra en la vista previa mientras se llena el formulario.
  protected readonly nameValue = signal('');
  protected readonly descriptionValue = signal('');
  protected readonly amountValue = signal(0);
  protected readonly isActiveValue = signal(true);

  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    description: this.formBuilder.nonNullable.control('', Validators.maxLength(300)),
    defaultAmount: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0), Validators.pattern(/^\d{1,14}(?:\.\d{1,4})?$/)]),
    isActive: this.formBuilder.nonNullable.control(true),
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncSignals(true));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      fineType: this.fineTypeId !== null
        ? this.catalogService.getFineTypeById(this.fineTypeId).pipe(catchError((error: unknown) => { this.loadError.set(describeApiError(error)); return of(null); }))
        : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ fineType }) => {
        if (this.fineTypeId !== null) {
          if (!fineType) {
            if (!this.loadError()) this.loadError.set('No encontramos este tipo de multa. Vuelve al listado y revisa.');
            return;
          }
          this.applyFineType(fineType);
        }
        this.syncSignals(false);
      });
  }

  private applyFineType(fineType: FineType): void {
    this.form.reset({
      name: fineType.name,
      description: fineType.description ?? '',
      defaultAmount: fineType.defaultAmount,
      isActive: fineType.isActive,
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
  }

  private syncSignals(markDirty: boolean): void {
    const controls = this.form.controls;
    this.nameValue.set(controls.name.value);
    this.descriptionValue.set(controls.description.value);
    this.amountValue.set(Number(controls.defaultAmount.value) || 0);
    this.isActiveValue.set(controls.isActive.value);
    if (markDirty) this.dirty.set(true);
  }

  // ── Textos de ayuda y errores ────────────────────────────────────────────────────────────

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe el nombre del tipo de multa.';
    if (control.hasError('maxlength')) return 'Usa 120 letras o menos.';
    return null;
  }

  protected descriptionError(): string | null {
    const control = this.form.controls.description;
    return control.touched && control.hasError('maxlength') ? 'Usa 300 letras o menos.' : null;
  }

  protected amountError(): string | null {
    const control = this.form.controls.defaultAmount;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe el monto por defecto.';
    return control.invalid ? 'Escribe el monto con números, por ejemplo 250 o 250.50. Usa 0 si se cobra a mano.' : null;
  }

  protected money(amount: number): string {
    try {
      return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', currencyDisplay: 'narrowSymbol' }).format(amount);
    } catch {
      return `C$ ${amount.toFixed(2)}`;
    }
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
    if (this.saving() || !this.network.online() || !this.session.hasPermission('service.fine-types')) return;
    this.saveError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const name = value.name.trim();
    const description = value.description.trim();
    const payload = {
      id: this.fineTypeId,
      name,
      description: description.length ? description : null,
      defaultAmount: Number(value.defaultAmount),
      isActive: value.isActive,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = payload.id !== null
      ? this.catalogService.updateFineType({ ...payload, id: payload.id })
      : this.catalogService.createFineType(payload);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dirty.set(false);
        this.toast.success(this.isEdit ? 'Tipo de multa actualizado' : 'Tipo de multa creado', name);
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error: unknown) => {
        this.saveError.set(describeApiError(error));
      },
    });
  }
}
