import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { PurchaseType, PurchaseUpsert } from '../../../../core/models/inventory/purchase.model';
import { Product } from '../../../../core/models/inventory/product.model';
import { Supplier } from '../../../../core/models/inventory/supplier.model';
import { CashBoxOperationsService } from '../../../../core/services/finance/cashbox-operations.service';
import { ProductService } from '../../../../core/services/inventory/product.service';
import { PurchaseService } from '../../../../core/services/inventory/purchase.service';
import { SupplierService } from '../../../../core/services/inventory/supplier.service';
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

/** Línea editable del documento: producto, cantidad y costo unitario. */
interface PurchaseLineForm {
  readonly productLineId: number;
  readonly productId: number;
  readonly quantity: number;
  readonly unitCost: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Valor centinela del combobox para «Otro / escribir nombre» (el combobox reserva 0 y '' para «sin elegir»). */
const OTHER_SUPPLIER = -1;

/**
 * Registrar una compra o una devolución a proveedor en un solo flujo, por
 * pasos: qué documento es y con qué caja, las líneas, y la confirmación.
 */
@Component({
  selector: 'rms-purchase-form-page',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, FieldComponent, FormPageComponent, NoticeComponent, PanelComponent],
  template: `
    <rms-form-page title="Registrar documento de inventario" eyebrow="INVENTARIO · COMPRAS"
      subtitle="Compra directa o devolución a proveedor. El stock se corrige y, si eliges una caja abierta, el dinero se mueve con el documento."
      [backLink]="backLink" backLabel="Volver" [steps]="steps" [current]="step()" [maxReached]="reached()"
      [busy]="saving()" withAside [status]="form.dirty ? 'Cambios sin guardar' : null" (stepSelect)="goTo($event)">

      @if (!network.online()) {
        <rms-notice tone="offline" title="Sin conexión">Necesitas conexión para registrar el documento.</rms-notice>
      }
      @if (!canCreate()) {
        <rms-notice tone="danger" title="No tienes permiso de inventario">Pídele a quien administra tu negocio que habilite el permiso de inventario.</rms-notice>
      }
      @if (error(); as message) {
        <rms-notice tone="danger" title="No se pudo continuar" dismissible (dismissed)="error.set(null)">{{ message }}</rms-notice>
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="purchases-form-stack" novalidate>
        @if (step() === 0) {
          <rms-panel title="¿Qué documento es?" subtitle="El tipo decide cómo se mueve el stock y el dinero.">
            <div class="rms-form-grid">
              <div class="purchases-type" role="radiogroup" aria-label="Tipo de documento">
                @for (option of typeChoices; track option.type) {
                  <button type="button" role="radio" [attr.aria-checked]="form.controls.purchaseType.value === option.type"
                    [class.is-selected]="form.controls.purchaseType.value === option.type" (click)="chooseType(option.type)">
                    <span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span>
                  </button>
                }
              </div>
            </div>

            <div class="rms-form-grid">
              <rms-field label="Proveedor" required span="full"
                [hint]="form.controls.purchaseType.value === 'DevolucionProveedor' ? 'A quién le devuelves la mercancía.' : 'A quién le compraste.'">
                <rms-combobox formControlName="supplierId" [options]="supplierOptions()" placeholder="Busca un proveedor…"
                  emptyText="No hay proveedores con ese nombre. Usa «Otro / escribir nombre»." ariaLabel="Proveedor"
                  (optionSelected)="onSupplierPicked($event)" />
              </rms-field>
              @if (isFreeSupplier()) {
                <rms-field label="Nombre del proveedor" required span="full" [error]="supplierNameError()"
                  hint="Se guarda como texto libre; si luego lo registras en Proveedores, quedará enlazado.">
                  <input class="rms-input" formControlName="supplierName" maxlength="150" aria-label="Nombre del proveedor" placeholder="Ej. Distribuidora Central" />
                </rms-field>
              }
              <rms-field label="Documento de referencia" optional hint="Factura o nota del proveedor, si la hay.">
                <input class="rms-input" formControlName="referenceDoc" maxlength="100" aria-label="Documento de referencia" placeholder="Ej. FC-001-0000123" />
              </rms-field>
              @if (cashOptions().length > 0) {
                <rms-field label="Dinero de caja" optional
                  [hint]="form.controls.purchaseType.value === 'DevolucionProveedor' ? 'El reintegro del proveedor entra a la caja del turno elegido.' : 'El pago sale de la caja del turno elegido.'">
                  <rms-combobox formControlName="cashBoxSessionId" [options]="cashOptions()" [loading]="cashLoading()" placeholder="Elegir turno abierto…"
                    emptyText="No hay turnos de caja abiertos" ariaLabel="Sesión de caja" />
                </rms-field>
              }
            </div>
            @if (cashOptions().length === 0) {
              <rms-notice tone="warning" title="La caja está cerrada">
                No hay turnos de caja abiertos. Puedes registrar el documento igual (solo inventario); el dinero se podrá reconciliar al arquear.
              </rms-notice>
            }
          </rms-panel>
        } @else if (step() === 1) {
          <rms-panel title="¿Qué productos mueve el documento?" subtitle="Producto, cantidad y costo unitario de cada línea.">
            <button type="button" class="rms-btn rms-btn--secondary purchases-add" (click)="addLine()"><rms-cazo-icon name="plus" [size]="16" /> Agregar producto</button>
            <div class="purchases-lines">
              @for (line of lines(); track line.productLineId) {
                <fieldset class="purchases-line">
                  <legend>Producto</legend>
                  <div class="rms-form-grid">
                    <rms-field label="Producto" required span="full">
                      <rms-combobox [loader]="searchProducts" [selectedOptions]="productOptions().get(line.productLineId) ?? []"
                        placeholder="Busca un producto por nombre…" emptyText="No encontramos productos activos con ese nombre"
                        ariaLabel="Producto de la línea" (optionSelected)="productPicked(line.productLineId, $event)" />
                    </rms-field>
                    <rms-field label="Cantidad" required [hint]="productOf(line.productId)?.unitOfMeasure ?? null">
                      <input class="rms-input" type="number" inputmode="decimal" min="0" step="0.01" [value]="line.quantity"
                        (change)="setLineNumber(line.productLineId, 'quantity', $event)" aria-label="Cantidad de la línea" />
                    </rms-field>
                    <rms-field label="Costo unitario (C$)" required>
                      <input class="rms-input" type="number" inputmode="decimal" min="0" step="0.01" [value]="line.unitCost"
                        (change)="setLineNumber(line.productLineId, 'unitCost', $event)" aria-label="Costo unitario de la línea" />
                    </rms-field>
                  </div>
                  @if (stockIssue(line); as issue) {
                    <rms-notice tone="warning" title="Stock insuficiente">{{ issue }}</rms-notice>
                  }
                  <button type="button" class="rms-btn rms-btn--ghost purchases-line-remove" (click)="removeLine(line.productLineId)">
                    <rms-cazo-icon name="trash" [size]="16" /> Quitar línea
                  </button>
                </fieldset>
              } @empty {
                <p class="rms-muted purchases-note">Agrega al menos un producto al documento.</p>
              }
            </div>
            <ul class="purchases-review">
              <li><span>Importe total</span><strong>C$ {{ totalAmount() | number:'1.2-2' }}</strong></li>
            </ul>
          </rms-panel>
        } @else {
          <rms-panel title="Confirma el documento" subtitle="Revisa el resumen. Al guardar, el stock y la caja se mueven de inmediato.">
            <div class="rms-form-grid">
              <rms-field label="Notas" optional span="full" hint="Queda en el documento y en el kardex de cada producto.">
                <input class="rms-input" formControlName="notes" maxlength="500" aria-label="Notas del documento" placeholder="Ej. Reposición del minibar del turno" />
              </rms-field>
            </div>
            <ul class="purchases-review">
              <li><span>Tipo</span><strong>{{ selectedTypeLabel() }}</strong></li>
              <li><span>Proveedor</span><strong>{{ supplierDisplay() || 'Sin proveedor' }}</strong></li>
              <li><span>Documento de referencia</span><strong>{{ form.controls.referenceDoc.value?.trim() || '—' }}</strong></li>
              <li><span>Caja</span><strong>{{ chosenCashLabel() }}</strong></li>
              <li class="purchases-total"><span>Importe total</span><strong>C$ {{ totalAmount() | number:'1.2-2' }}</strong></li>
            </ul>
          </rms-panel>
        }
      </form>

      <aside aside>
        <rms-panel title="Resumen del documento" raised>
          <ul class="purchases-summary">
            <li><span>Tipo</span><strong>{{ selectedTypeLabel() }}</strong></li>
            <li><span>Líneas</span><strong>{{ lines().length }}</strong></li>
            <li><span>Dinero de caja</span><strong>{{ chosenCashLabel() }}</strong></li>
          </ul>
          <div class="purchases-delta" aria-live="polite">
            <div><small>En inventario</small><strong>{{ form.controls.purchaseType.value === 'DevolucionProveedor' ? 'Sale stock' : 'Entra stock' }}</strong></div>
            <div class="purchases-delta__op" [class.is-in]="form.controls.purchaseType.value === 'DevolucionProveedor'">
              <small>Dinero</small>
              <strong>{{ form.controls.purchaseType.value === 'DevolucionProveedor' ? 'Entra a caja' : 'Sale de caja' }}</strong>
            </div>
            <div><small>Importe</small><strong>C$ {{ totalAmount() | number:'1.2-2' }}</strong></div>
          </div>
          @if (form.controls.purchaseType.value === 'DevolucionProveedor') {
            <p class="rms-muted purchases-note">El proveedor reintegra el dinero a la caja elegida y el stock del producto se resta.</p>
          }
        </rms-panel>
      </aside>

      <ng-container footer>
        <a class="rms-btn rms-btn--ghost" [routerLink]="backLink">Cancelar</a>
        @if (step() > 0) { <button type="button" class="rms-btn rms-btn--secondary" (click)="back()" [disabled]="saving()">Atrás</button> }
        @if (step() < 2) {
          <button type="button" class="rms-btn rms-btn--primary" (click)="next()" [disabled]="saving()">Continuar <rms-cazo-icon name="arrow-right" [size]="16" /></button>
        } @else {
          <button type="button" class="rms-btn rms-btn--primary" [disabled]="saving() || !network.online() || !canCreate()" (click)="save()">
            @if (saving()) { <span class="rms-spinner"></span> Registrando… } @else { <rms-cazo-icon name="check" [size]="16" /> Guardar documento }
          </button>
        }
      </ng-container>
    </rms-form-page>
  `,
  styles: `
    :host { display: block; }
    .purchases-form-stack { display: grid; gap: 16px; }
    .purchases-type { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .purchases-type button { display: flex; align-items: flex-start; gap: 10px; text-align: left; border: 1px solid var(--cazo-line); border-radius: var(--cazo-radius-sm); background: var(--cazo-soft); padding: 12px 14px; cursor: pointer; }
    .purchases-type button.is-selected { border-color: var(--cazo-brand); background: var(--cazo-brand-soft, var(--cazo-soft)); }
    .purchases-type strong { display: block; font-size: 14px; }
    .purchases-type small { color: var(--cazo-muted); font-size: 12px; }
    .purchases-add { margin-bottom: 12px; }
    .purchases-lines { display: grid; gap: 12px; }
    .purchases-line { border: 1px solid var(--cazo-line); border-radius: var(--cazo-radius-sm); padding: 12px 14px; background: var(--cazo-soft); margin: 0; display: grid; gap: 10px; }
    .purchases-line legend { color: var(--cazo-muted); font-size: 12px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; padding: 0 4px; }
    .purchases-line-remove { justify-self: start; }
    .purchases-note { font-size: 13px; }
    .purchases-review, .purchases-summary { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
    .purchases-review li, .purchases-summary li { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .purchases-review span, .purchases-summary span { color: var(--cazo-muted); }
    .purchases-total { border-top: 1px solid var(--cazo-line); padding-top: 10px; font-size: 16px; }
    .purchases-delta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; border-top: 1px solid var(--cazo-line); margin-top: 14px; padding-top: 12px; text-align: center; }
    .purchases-delta small { display: block; color: var(--cazo-muted); }
    .purchases-delta__op strong.is-in { color: var(--cazo-success, var(--cazo-brand)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseFormPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly products = inject(ProductService);
  private readonly purchases = inject(PurchaseService);
  private readonly suppliers = inject(SupplierService);
  private readonly cashBoxes = inject(CashBoxOperationsService);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly backLink = '/admin/purchases';
  protected readonly step = signal(0);
  protected readonly reached = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly tickValue = signal(0);

  private nextLineId = 1;

  protected readonly steps = [
    { id: 'document', label: 'Documento', description: 'Tipo, proveedor y caja' },
    { id: 'lines', label: 'Productos', description: 'Cantidad y costo por línea' },
    { id: 'confirm', label: 'Confirmar', description: 'Resumen y notas' },
  ];

  protected readonly typeChoices: readonly { readonly type: PurchaseType; readonly label: string; readonly description: string }[] = [
    { type: 'Compra', label: 'Compra directa', description: 'Entra stock y, si eliges caja, se paga de allí' },
    { type: 'DevolucionProveedor', label: 'Devolución a proveedor', description: 'Sale stock y el proveedor reintegra el dinero' },
  ];

  protected readonly form = this.formBuilder.group({
    purchaseType: this.formBuilder.control<PurchaseType>('Compra', { nonNullable: true }),
    supplierId: this.formBuilder.control<number | null>(null),
    supplierName: ['', Validators.maxLength(150)],
    referenceDoc: ['', Validators.maxLength(100)],
    cashBoxSessionId: this.formBuilder.control<number | null>(null),
    notes: ['', Validators.maxLength(500)],
  });

  protected readonly lines = signal<readonly PurchaseLineForm[]>([]);

  /** Proveedores activos del maestro para el selector local del documento. */
  protected readonly activeSuppliers = signal<readonly Supplier[]>([]);

  protected readonly productsById = signal<ReadonlyMap<number, Product>>(new Map());

  protected readonly openCashSessions = signal<readonly { readonly sessionId: number; readonly label: string }[]>([]);
  protected readonly cashLoading = signal(true);

  protected readonly cashOptions = computed<readonly ComboboxOption<number>[]>(() =>
    this.openCashSessions().map((row) => ({ value: row.sessionId, label: row.label })));

  protected readonly canCreate = computed(
    () => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:movements'),
  );

  protected readonly totalAmount = computed(() => {
    this.tickValue();
    return round2(this.lines().reduce((sum, line) => sum + line.quantity * line.unitCost, 0));
  });

  protected readonly selectedTypeLabel = computed(() => {
    const type = this.form.controls.purchaseType.value;
    return this.typeChoices.find((choice) => choice.type === type)?.label ?? type;
  });

  protected readonly chosenCashLabel = computed(() => {
    const sessionId = this.form.controls.cashBoxSessionId.value;
    if (!sessionId) return 'No mueve dinero en caja';
    return this.openCashSessions().find((row) => row.sessionId === sessionId)?.label ?? `Turno No. ${sessionId}`;
  });

  protected readonly supplierOptions = computed<readonly ComboboxOption<number>[]>(() => {
    const options: ComboboxOption<number>[] = this.activeSuppliers().map((supplier) => ({
      value: supplier.supplierId,
      label: supplier.name,
      hint: [supplier.contactName, supplier.phone].filter(Boolean).join(' · ') || 'Proveedor del maestro',
    }));
    options.push({ value: OTHER_SUPPLIER, label: 'Otro / escribir nombre', hint: 'Proveedor que todavía no está en el maestro' });
    return options;
  });

  /** El documento va a guardar el nombre escrito a mano (proveedor fuera del maestro). */
  protected readonly isFreeSupplier = computed(() => {
    this.tickValue();
    return this.form.controls.supplierId.value === OTHER_SUPPLIER;
  });

  /** Nombre del proveedor para el resumen y la confirmación. */
  protected readonly supplierDisplay = computed(() => {
    this.tickValue();
    const supplierId = this.form.controls.supplierId.value;
    if (supplierId !== null && supplierId > 0) {
      return this.activeSuppliers().find((supplier) => supplier.supplierId === supplierId)?.name ?? 'Proveedor del maestro';
    }
    return (this.form.controls.supplierName.value ?? '').trim() || '';
  });

  protected readonly productOptions = computed<ReadonlyMap<number, readonly ComboboxOption<number>[]>>(() => {
    this.tickValue();
    const map = new Map<number, readonly ComboboxOption<number>[]>();
    for (const line of this.lines()) {
      const product = this.productsById().get(line.productId);
      if (product) {
        map.set(line.productLineId, [{
          value: product.productId,
          label: product.name,
          hint: [product.code, product.categoryName].filter(Boolean).join(' · ') || undefined,
        }]);
      }
    }
    return map;
  });

  protected readonly searchProducts: ComboboxLoader<number> = (term) => this.products
    .list({ pageNumber: 1, pageSize: 20, name: term.trim(), categoryId: null, isActive: true })
    .pipe(
      map((page) => {
        // Guardamos productos para validar stock de las líneas de devolución.
        this.productsById.update((current) => {
          const next = new Map(current);
          for (const product of page.items) next.set(product.productId, product);
          return next;
        });
        return page.items.map((item) => ({
          value: item.productId,
          label: item.name,
          hint: [item.code, item.categoryName].filter(Boolean).join(' · ') || undefined,
        }));
      }),
    );

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.tick());
    this.suppliers.listActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (suppliers) => this.activeSuppliers.set(suppliers) });
    this.cashBoxes.monitor()
      .pipe(
        map((rows) => rows
          .filter((row) => row.isOpen)
          .map((row) => ({
            sessionId: row.sessionId ?? 0,
            label: `${row.name} · ${row.shiftName} (${row.userName ?? 'sin usuario'})`,
          }))
          .filter((row) => row.sessionId > 0)),
        finalize(() => this.cashLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (sessions) => this.openCashSessions.set(sessions),
        error: () => this.cashLoading.set(false),
      });
  }

  protected readonly tick = (): void => this.tickValue.update((value) => value + 1);

  protected chooseType(type: PurchaseType): void {
    this.form.patchValue({ purchaseType: type });
    this.tick();
  }

  /** El combobox del maestro copia el nombre elegido y habilita el texto libre con «Otro». */
  protected onSupplierPicked(option: ComboboxOption<number> | null): void {
    const value = option?.value ?? null;
    if (value !== null && value > 0) {
      this.form.controls.supplierName.setValue(this.activeSuppliers().find((supplier) => supplier.supplierId === value)?.name ?? '');
    } else {
      this.form.controls.supplierName.setValue('');
    }
    this.tick();
  }

  protected supplierNameError(): string | null {
    const control = this.form.controls.supplierName;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('maxlength')) return 'Usa 150 letras o menos.';
    return null;
  }

  protected addLine(): void {
    this.lines.update((current) => [...current, { productLineId: this.nextLineId++, productId: 0, quantity: 1, unitCost: 0 }]);
    this.tick();
  }

  protected removeLine(productLineId: number): void {
    this.lines.update((current) => current.filter((line) => line.productLineId !== productLineId));
    this.tick();
  }

  protected productPicked(productLineId: number, option: ComboboxOption<number> | null): void {
    if (!option) {
      this.updateLine(productLineId, { productId: 0, unitCost: 0 });
      return;
    }
    // El combobox de servidor no entrega el producto completo: lo resolvemos con el servicio.
    this.products.getById(option.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          if (!product) return;
          this.productsById.update((current) => new Map(current).set(product.productId, product));
          const isReturn = this.form.controls.purchaseType.value === 'DevolucionProveedor';
          this.updateLine(productLineId, {
            productId: product.productId,
            unitCost: isReturn ? product.costPrice : (product.costPrice || 0),
          });
          this.tick();
        },
      });
  }

  protected setLineNumber(productLineId: number, field: 'quantity' | 'unitCost', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.updateLine(productLineId, { [field]: Number.isFinite(value) ? value : 0 });
    this.tick();
  }

  protected productOf(productId: number): Product | null {
    return this.productsById().get(productId) ?? null;
  }

  /** En una devolución a proveedor, la cantidad no puede superar el stock. */
  protected stockIssue(line: PurchaseLineForm): string | null {
    if (this.form.controls.purchaseType.value !== 'DevolucionProveedor') return null;
    const product = this.productOf(line.productId);
    if (!product || line.quantity <= 0) return null;
    if (line.quantity > product.currentStock) return `Solo hay ${product.currentStock} ${product.unitOfMeasure} en existencia de ${product.name}.`;
    return null;
  }

  private supplierIssue(): string | null {
    const supplierId = this.form.controls.supplierId.value;
    if (supplierId !== null && supplierId > 0) return null;
    if (this.isFreeSupplier() && !(this.form.controls.supplierName.value ?? '').trim()) {
      return 'Escribe el nombre del proveedor que no está en el maestro.';
    }
    if (!(this.form.controls.supplierName.value ?? '').trim()) {
      return 'Elige un proveedor del maestro o escribe su nombre en «Otro».';
    }
    return null;
  }

  protected linesInvalid(): string | null {
    if (this.lines().length === 0) return 'Agrega al menos un producto al documento.';
    for (const line of this.lines()) {
      if (!line.productId) return 'Todas las líneas necesitan un producto.';
      if (!(line.quantity > 0)) return 'Escribe una cantidad mayor que cero en todas las líneas.';
      if (line.unitCost < 0) return 'El costo unitario no puede ser negativo.';
      if (this.stockIssue(line)) return this.stockIssue(line) ?? null;
    }
    return null;
  }

  protected goTo(index: number): void {
    if (index <= this.step()) { this.step.set(index); return; }
    this.next();
  }

  protected back(): void {
    this.error.set(null);
    this.step.update((value) => value - 1);
  }

  protected next(): void {
    this.error.set(null);
    if (this.step() === 0) {
      const type = this.form.controls.purchaseType.value;
      if (!this.typeChoices.some((choice) => choice.type === type)) { this.error.set('Elige el tipo de documento.'); return; }
      const supplierIssue = this.supplierIssue();
      if (supplierIssue) { this.error.set(supplierIssue); return; }
      const target = 1;
      this.step.set(target);
      this.reached.set(Math.max(this.reached(), target));
      return;
    }
    if (this.step() === 1) {
      const issue = this.linesInvalid();
      if (issue) { this.error.set(issue); return; }
      const target = 2;
      this.step.set(target);
      this.reached.set(Math.max(this.reached(), target));
    }
  }

  protected save(): void {
    if (this.saving() || !this.network.online()) return;
    if (this.linesInvalid()) { this.step.set(1); this.error.set(this.linesInvalid() ?? ''); return; }
    if (this.lines().length === 0) return;
    const value = this.form.getRawValue();
    const type = value.purchaseType;
    const supplierIssue = this.supplierIssue();
    if (supplierIssue) { this.step.set(0); this.error.set(supplierIssue); return; }
    const supplierId = value.supplierId !== null && value.supplierId > 0 ? value.supplierId : null;
    const supplierName = (value.supplierName ?? '').trim();
    const payload: PurchaseUpsert = {
      purchaseType: type,
      supplierId,
      supplierName: supplierName || null,
      referenceDoc: (value.referenceDoc ?? '').trim() || null,
      cashBoxSessionId: value.cashBoxSessionId ?? null,
      notes: (value.notes ?? '').trim() || null,
      items: this.lines().map((line) => ({ productId: line.productId, quantity: line.quantity, unitCost: line.unitCost })),
    };
    this.saving.set(true);
    this.error.set(null);
    this.purchases.create(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (purchaseId) => {
          this.products.invalidateCache();
          this.purchases.invalidateCache();
          this.toast.success('Documento registrado', `${this.selectedTypeLabel()} No. ${purchaseId}`);
          void this.router.navigateByUrl(this.backLink);
        },
        error: (error: unknown) => this.error.set(describeApiError(error)),
      });
  }

  private updateLine(productLineId: number, patch: Partial<Omit<PurchaseLineForm, 'productLineId'>>): void {
    this.lines.update((current) => current.map((line) => (line.productLineId === productLineId ? { ...line, ...patch } : line)));
  }
}
