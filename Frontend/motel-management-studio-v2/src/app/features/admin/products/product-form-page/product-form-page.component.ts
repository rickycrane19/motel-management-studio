import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { Product, ProductUpsert } from '../../../../core/models/inventory/product.model';
import { Category } from '../../../../core/models/inventory/category.model';
import { ProductService } from '../../../../core/services/inventory/product.service';
import { CategoryService } from '../../../../core/services/inventory/category.service';
import { PRODUCT_IMAGE_PLACEHOLDER } from '../../../../shared/presentation/product-presentation';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  EmptyStateComponent,
  FieldComponent,
  FileDropComponent,
  FormPageComponent,
  NoticeComponent,
  PanelComponent,
  StepItem,
  ToastService,
} from '../../../../shared/ui';

const UNITS: readonly string[] = ['UND', 'KG', 'LT', 'CJA', 'PAQ', 'BLT'];

@Component({
  selector: 'rms-product-form-page',
  imports: [
    ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, EmptyStateComponent, FieldComponent, FileDropComponent,
    FormPageComponent, NoticeComponent, PanelComponent,
  ],
  templateUrl: './product-form-page.component.html',
  styleUrl: './product-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly products = inject(ProductService);
  private readonly categoriesService = inject(CategoryService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly productId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.productId !== null;
  protected readonly backLink = '/admin/products';

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
  protected readonly nameValue = signal('');
  protected readonly descriptionValue = signal('');
  protected readonly saleAmount = signal(0);
  protected readonly isActiveValue = signal(true);

  protected readonly current = signal<Product | null>(null);
  protected readonly categories = signal<readonly ComboboxOption<number>[]>([]);
  protected readonly units = signal<readonly ComboboxOption<string>[]>(UNITS.map((unit) => ({ value: unit, label: unit })));

  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly storedImage = signal<string | null>(null);
  protected readonly imageError = signal<string | null>(null);
  protected readonly placeholder = PRODUCT_IMAGE_PLACEHOLDER;

  protected readonly form = this.formBuilder.group({
    code: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.formBuilder.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    description: this.formBuilder.nonNullable.control('', Validators.maxLength(500)),
    categoryId: this.formBuilder.control<number | null>(null, Validators.required),
    unitOfMeasure: this.formBuilder.nonNullable.control('UND', Validators.required),
    imageUrl: this.formBuilder.nonNullable.control(''),
    costPrice: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0), Validators.pattern(/^\d{1,14}(?:\.\d{1,4})?$/)]),
    salePrice: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0), Validators.pattern(/^\d{1,14}(?:\.\d{1,4})?$/)]),
    currentStock: this.formBuilder.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    minStock: this.formBuilder.nonNullable.control(5, [Validators.required, Validators.min(0)]),
    isActive: this.formBuilder.nonNullable.control(true),
  });

  protected readonly steps = computed<readonly StepItem[]>(() => {
    this.tick();
    return [
      { id: 'info', label: 'Información', description: 'Nombre, categoría y foto', invalid: this.stepInvalid(0) },
      { id: 'precios', label: 'Precios', description: 'Costo y precio de venta', invalid: this.stepInvalid(1) },
      { id: 'existencias', label: 'Existencias', description: 'Stock inicial y mínimo', invalid: this.stepInvalid(2) },
      { id: 'publicacion', label: 'Publicación', description: 'Revisa y publica' },
    ];
  });
  protected readonly lastStep = computed(() => this.steps().length - 1);

  protected readonly photoPreview = computed(() => this.imagePreview() ?? this.storedImage());
  protected readonly cardImage = computed(() => this.photoPreview() ?? this.placeholder);
  protected readonly hasImage = computed(() => !!this.photoPreview());

  protected readonly readiness = computed(() => {
    this.tick();
    const controls = this.form.controls;
    return [
      { label: 'Nombre, código, categoría y unidad', done: controls.name.valid && controls.code.valid && controls.categoryId.valid, step: 0 },
      { label: 'Costo y precio de venta', done: controls.costPrice.valid && this.saleAmount() > 0, step: 1 },
      { label: 'Existencias y stock mínimo', done: controls.currentStock.valid && controls.minStock.valid, step: 2 },
      { label: 'Foto del producto (opcional)', done: this.hasImage(), step: 0, optional: true },
    ];
  });

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncSignals(true));
    this.load();
  }

  ngOnDestroy(): void {
    this.releasePreview();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      categories: this.categoriesService.listActive().pipe(catchError(() => of([] as readonly Category[]))),
      product: this.productId !== null
        ? this.products.getById(this.productId).pipe(catchError((error: unknown) => { this.loadError.set(describeApiError(error)); return of(null); }))
        : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ categories, product }) => {
        this.categories.set(categories.map((item) => ({ value: item.categoryId, label: item.name })));
        if (this.productId !== null) {
          if (!product) { if (!this.loadError()) this.loadError.set('No encontramos este producto. Vuelve al listado y revisa.'); return; }
          this.applyProduct(product);
        } else {
          this.form.patchValue({ currentStock: 0, minStock: 5 }, { emitEvent: false });
          this.form.markAsPristine();
          this.dirty.set(false);
        }
        this.syncSignals(false);
      });
  }

  private applyProduct(product: Product): void {
    this.current.set(product);
    this.storedImage.set(product.imageUrl);
    this.form.reset({
      code: product.code, name: product.name, description: product.description ?? '', categoryId: product.categoryId,
      unitOfMeasure: product.unitOfMeasure || 'UND', imageUrl: product.imageUrl ?? '',
      costPrice: product.costPrice, salePrice: product.salePrice, currentStock: product.currentStock, minStock: product.minStock,
      isActive: product.isActive,
    }, { emitEvent: false });
    this.form.markAsPristine();
    this.dirty.set(false);
    this.reached.set(this.lastStep());
  }

  private syncSignals(markDirty: boolean): void {
    this.tick.update((value) => value + 1);
    const controls = this.form.controls;
    this.nameValue.set(controls.name.value);
    this.descriptionValue.set(controls.description.value);
    this.isActiveValue.set(controls.isActive.value);
    this.saleAmount.set(Number(controls.salePrice.value) || 0);
    if (markDirty) this.dirty.set(true);
  }

  // ── Foto ─────────────────────────────────────────────────────────────────────────────────
  protected onImage(file: File): void {
    this.releasePreview();
    this.imageFile.set(file);
    this.imagePreview.set(URL.createObjectURL(file));
    this.imageError.set(null);
    this.dirty.set(true);
  }

  protected removeImage(): void {
    this.releasePreview();
    this.storedImage.set(null);
    this.form.controls.imageUrl.setValue('');
    this.dirty.set(true);
  }

  private releasePreview(): void {
    const url = this.imagePreview();
    if (url) URL.revokeObjectURL(url);
    this.imagePreview.set(null);
    this.imageFile.set(null);
  }

  // ── Textos de ayuda y errores ────────────────────────────────────────────────────────────
  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe cómo se llama el producto.';
    if (control.hasError('maxlength')) return 'Usa 200 letras o menos.';
    return null;
  }

  protected codeError(): string | null {
    const control = this.form.controls.code;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Escribe un código corto, por ejemplo «CERV-XXL».';
    return null;
  }

  protected categoryError(): string | null {
    const control = this.form.controls.categoryId;
    return control.touched && control.invalid ? 'Elige la categoría del minibar.' : null;
  }

  protected costError(): string | null {
    const control = this.form.controls.costPrice;
    if (!control.touched && !control.dirty) return null;
    return control.invalid ? 'Escribe el costo con números, por ejemplo 42.5. Usa 0 si aún no lo sabes.' : null;
  }

  protected saleError(): string | null {
    const control = this.form.controls.salePrice;
    if (!control.touched && !control.dirty) return null;
    return control.invalid ? 'Escribe el precio de venta, por ejemplo 85.50.' : null;
  }

  protected stockError(): string | null {
    const control = this.form.controls.currentStock;
    if (!control.touched && !control.dirty) return null;
    return control.invalid ? 'Escribe cuántas unidades tienes ahora (0 o más).' : null;
  }

  protected minStockError(): string | null {
    const control = this.form.controls.minStock;
    if (!control.touched && !control.dirty) return null;
    return control.invalid ? 'Escribe el mínimo con el que avisas stock bajo (0 o más).' : null;
  }

  protected toNumber(value: unknown): number {
    return Number(value) || 0;
  }

  protected money(amount: number): string {
    try {
      return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', currencyDisplay: 'narrowSymbol' }).format(amount);
    } catch {
      return `C$ ${amount.toFixed(2)}`;
    }
  }

  // ── Navegación entre pasos ───────────────────────────────────────────────────────────────
  protected stepInvalid(index: number): boolean {
    if (!this.attempted().has(index)) return false;
    const controls = this.form.controls;
    if (index === 0) return controls.name.invalid || controls.code.invalid || controls.categoryId.invalid;
    if (index === 1) return controls.costPrice.invalid || controls.salePrice.invalid;
    if (index === 2) return controls.currentStock.invalid || controls.minStock.invalid;
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
      [controls.name, controls.code, controls.categoryId].forEach((control) => control.markAsTouched());
      return !(controls.name.invalid || controls.code.invalid || controls.categoryId.invalid);
    }
    if (step === 1) {
      [controls.costPrice, controls.salePrice].forEach((control) => control.markAsTouched());
      if (controls.costPrice.invalid || controls.salePrice.invalid) return false;
    }
    if (step === 2) {
      [controls.currentStock, controls.minStock].forEach((control) => control.markAsTouched());
      if (controls.currentStock.invalid || controls.minStock.invalid) return false;
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
    if (!this.validateStep(2)) { this.step.set(2); return; }
    const value = this.form.getRawValue();
    const payload: ProductUpsert & { id?: number } = {
      name: value.name.trim(),
      code: value.code.trim(),
      description: this.nullIfEmpty(value.description),
      categoryId: Number(value.categoryId),
      costPrice: Number(value.costPrice),
      salePrice: Number(value.salePrice),
      currentStock: Number(value.currentStock),
      minStock: Number(value.minStock),
      unitOfMeasure: String(value.unitOfMeasure ?? 'UND').trim().toUpperCase(),
      imageUrl: this.nullIfEmpty(value.imageUrl),
      ...(this.imageFile() ? { imageFile: this.imageFile()! } : {}),
      isActive: value.isActive,
    };
    this.saving.set(true);
    const request$: Observable<unknown> = this.productId !== null ? this.products.update({ ...payload, id: this.productId }) : this.products.create(payload);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.dirty.set(false);
        this.toast.success(this.isEdit ? 'Producto actualizado' : 'Producto creado', payload.name);
        void this.router.navigateByUrl(this.backLink);
      },
      error: (error: unknown) => {
        this.saveError.set(describeApiError(error));
      },
    });
  }

  protected saveWithoutPhoto(): void {
    this.releasePreview();
    this.save();
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized.length ? normalized : null;
  }
}
