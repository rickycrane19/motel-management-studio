import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { Product } from '../../../../core/models/inventory/product.model';
import { InventoryMovementUpsert } from '../../../../core/models/inventory/movement.model';
import { ProductService } from '../../../../core/services/inventory/product.service';
import {
  MovementService,
  MOVEMENT_TYPE_LABELS,
  movementSign,
  IN_MOVEMENT_TYPES,
  OUT_MOVEMENT_TYPES,
} from '../../../../core/services/inventory/movement.service';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxLoader,
  ComboboxOption,
  FieldComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  ToastService,
} from '../../../../shared/ui';

const REASONS: readonly string[] = [
  'Conteo físico',
  'Merma',
  'Producto dañado',
  'Consumo interno',
  'Compra nueva',
  'Corrección de captura',
];

/**
 * Registro de un movimiento de kardex, en dos pasos: qué mueves (producto,
 * operación y cantidad) y por qué (motivo, doc. y costo). El signo (+/−) lo
 * define la SP del backend según el tipo elegido.
 */
@Component({
  selector: 'rms-movement-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, DecimalPipe, CazoIconComponent, ComboboxComponent,
    FieldComponent, FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './movement-form-page.component.html',
  styleUrl: './movement-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementFormPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly products = inject(ProductService);
  private readonly movements = inject(MovementService);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly backLink = '/admin/movements';
  protected readonly step = signal(0);
  protected readonly reached = signal(0);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadingProduct = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<Product | null>(null);
  protected readonly selectedProductOption = signal<ComboboxOption<number>[]>([]);
  protected readonly typeId = signal<string | null>(null);
  protected readonly reason = signal<string>('');
  private readonly tick = signal(0);

  protected readonly reasons = REASONS;
  protected readonly canRecord = computed(
    () => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:movements'),
  );

  protected readonly steps = [
    { id: 'what', label: 'Qué mueves', description: 'Producto, operación y cantidad' },
    { id: 'why', label: 'Por qué', description: 'Motivo y documento' },
  ];

  protected readonly form = this.formBuilder.group({
    productId: this.formBuilder.control<number | null>(null),
    quantity: this.formBuilder.control<number | null>(null),
    unitCost: this.formBuilder.control<number | null>(null),
    referenceDoc: ['', Validators.maxLength(100)],
    detail: ['', Validators.maxLength(250)],
  });

  protected readonly movementTypes: readonly { readonly type: string; readonly sign: 1 | -1 }[] = [
    ...[...IN_MOVEMENT_TYPES, ...OUT_MOVEMENT_TYPES].map((type) => ({ type, sign: movementSign(type) })),
  ];

  protected readonly selectedType = computed(() => this.movementTypes.find((item) => item.type === this.typeId()) ?? null);
  protected readonly isEntry = computed(() => (this.selectedType()?.sign ?? 0) > 0);
  protected readonly typeLabel = (type: string): string => MOVEMENT_TYPE_LABELS[type] ?? type;
  protected readonly unit = computed(() => this.product()?.unitOfMeasure ?? '');
  protected readonly stockBefore = computed(() => this.product()?.currentStock ?? null);
  protected readonly quantity = computed(() => { this.tick(); return this.form.controls.quantity.value ?? 0; });
  protected readonly after = computed<number | null>(() => {
    const before = this.stockBefore();
    const type = this.selectedType();
    const quantity = this.quantity();
    if (before === null || !type || quantity <= 0) return null;
    return Math.round((before + type.sign * quantity) * 100) / 100;
  });
  protected readonly quantityError = computed<string | null>(() => {
    this.tick();
    const quantity = this.quantity();
    const type = this.selectedType();
    if (!this.form.controls.quantity.touched && !quantity) return null;
    if (!(quantity > 0)) return 'Escribe una cantidad mayor que cero.';
    if (type && type.sign < 0) {
      const before = this.stockBefore();
      if (before !== null && quantity > before) return `Solo hay ${before} ${this.unit()} en existencia.`;
    }
    return null;
  });
  protected readonly canContinue = computed(() => {
    this.tick();
    return !!this.product() && !!this.selectedType() && this.quantity() > 0 && !this.quantityError();
  });
  protected readonly reasonText = computed(() => {
    this.tick();
    const chip = this.reason();
    const detail = (this.form.controls.detail.value ?? '').trim();
    if (!chip) return detail;
    return detail ? `${chip}: ${detail}` : chip;
  });
  protected readonly reasonError = computed<string | null>(() => {
    this.tick();
    if (!this.reason() && !this.form.controls.detail.touched) return null;
    return this.reasonText().length < 5 ? 'Cuenta brevemente por qué mueves el inventario (mínimo 5 letras).' : null;
  });
  protected readonly canSave = computed(() => this.canContinue() && this.reasonText().length >= 5 && !this.saving());

  protected readonly searchProducts: ComboboxLoader<number> = (term) => this.products
    .list({ pageNumber: 1, pageSize: 20, name: term.trim(), categoryId: null, isActive: true })
    .pipe(map((page) => page.items.map((item) => ({
      value: item.productId,
      label: item.name,
      hint: [item.code, item.categoryName].filter(Boolean).join(' · ') || undefined,
    }))));

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.tick.update((value) => value + 1));
    // Atajo: ?productId= preselecciona el producto (llega desde la ficha del producto).
    const productId = Number(this.route.snapshot.queryParamMap.get('productId')) || null;
    if (productId) {
      this.products.getById(productId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (product) => {
          this.loading.set(false);
          if (product && product.isActive) this.pickProduct(product);
          else this.error.set('No encontramos ese producto activo en el catálogo.');
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loading.set(false);
    }
  }

  protected productPicked(option: ComboboxOption<number> | null): void {
    if (!option) {
      this.product.set(null);
      this.form.patchValue({ productId: null });
      this.tick.update((value) => value + 1);
      return;
    }
    this.loadingProduct.set(true);
    this.products.getById(option.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (product) => { this.loadingProduct.set(false); if (product) this.pickProduct(product); },
      error: (error: unknown) => { this.loadingProduct.set(false); this.error.set(describeApiError(error)); },
    });
  }

  private pickProduct(product: Product): void {
    this.error.set(null);
    this.product.set(product);
    this.selectedProductOption.set([{
      value: product.productId,
      label: product.name,
      hint: [product.code, product.categoryName].filter(Boolean).join(' · ') || undefined,
    }]);
    this.form.patchValue({ productId: product.productId, unitCost: null }, { emitEvent: false });
    this.tick.update((value) => value + 1);
  }

  protected chooseType(type: string): void {
    this.typeId.set(this.typeId() === type ? null : type);
    this.tick.update((value) => value + 1);
  }

  protected chooseReason(reason: string): void {
    this.reason.set(this.reason() === reason ? '' : reason);
    this.tick.update((value) => value + 1);
  }

  protected toNumber(value: unknown): number {
    return Number(value) || 0;
  }

  protected next(): void {
    this.form.controls.quantity.markAsTouched();
    if (!this.canContinue()) {
      this.tick.update((value) => value + 1);
      if (!this.product()) this.error.set('Elige el producto que vas a mover.');
      else if (!this.selectedType()) this.error.set('Elige si el movimiento suma o resta existencias.');
      else this.error.set(this.quantityError() ?? 'Escribe la cantidad del movimiento.');
      return;
    }
    this.error.set(null);
    this.step.set(1);
    this.reached.set(Math.max(this.reached(), 1));
  }

  protected back(): void {
    this.error.set(null);
    this.step.set(0);
  }

  protected goTo(index: number): void {
    if (index === 0) this.back();
    else if (index <= this.reached()) this.next();
  }

  protected save(): void {
    this.form.controls.detail.markAsTouched();
    if (this.saving() || !this.network.online()) return;
    if (!this.canSave()) { this.tick.update((value) => value + 1); return; }
    const value = this.form.getRawValue();
    const type = this.selectedType();
    const product = this.product();
    if (!type || !product) return;
    this.saving.set(true);
    this.error.set(null);
    const payload: InventoryMovementUpsert = {
      productId: product.productId,
      movementType: type.type,
      quantity: value.quantity ?? 0,
      // Vacío = que el SP use el costo actual del producto.
      unitCost: value.unitCost !== null && value.unitCost > 0 ? value.unitCost : null,
      reason: this.reasonText().slice(0, 250),
      referenceDoc: (value.referenceDoc ?? '').trim().slice(0, 100) || null,
    };
    this.movements.create(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (movementId) => {
          this.products.invalidateCache();
          this.movements.invalidateCache();
          this.toast.success('Movimiento registrado', `${MOVEMENT_TYPE_LABELS[type.type] ?? type.type} · ${product.name}`);
          void this.router.navigateByUrl(this.backLink);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    this.error.set(describeApiError(error));
  }
}
