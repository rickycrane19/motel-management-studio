import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, map } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { describeApiError } from '../../../../core/http/api-error';
import { CustomerReturnUpsert } from '../../../../core/models/inventory/purchase.model';
import { Product } from '../../../../core/models/inventory/product.model';
import { ProductService } from '../../../../core/services/inventory/product.service';
import { CashBoxOperationsService } from '../../../../core/services/finance/cashbox-operations.service';
import { CustomerReturnService } from '../../../../core/services/inventory/customer-return.service';
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

/** Línea editable de la devolución: producto, unidades devueltas y precio de venta devuelto. */
interface ReturnLineForm {
  readonly productLineId: number;
  readonly productId: number;
  readonly quantity: number;
  readonly unitPrice: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Registrar la devolución de productos por parte de un cliente, por pasos:
 * quién devuelve y desde qué caja, qué productos regresan, y el reembolso.
 * El dinero sale de la caja elegida y el stock del producto reingresa.
 */
@Component({
  selector: 'rms-customer-return-form-page',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, CazoIconComponent, ComboboxComponent, FieldComponent, FormPageComponent, NoticeComponent, PanelComponent],
  template: `
    <rms-form-page title="Registrar devolución de cliente" eyebrow="INVENTARIO · DEVOLUCIONES"
      subtitle="El cliente devuelve productos del minibar. El stock reingresa y el reembolso en efectivo sale de tu caja."
      [backLink]="backLink" backLabel="Volver" [steps]="steps" [current]="step()" [maxReached]="reached()"
      [busy]="saving()" withAside [status]="form.dirty ? 'Cambios sin guardar' : null" (stepSelect)="goTo($event)">

      @if (!network.online()) {
        <rms-notice tone="offline" title="Sin conexión">Necesitas conexión para registrar la devolución.</rms-notice>
      }
      @if (!canCreate()) {
        <rms-notice tone="danger" title="No tienes permiso de inventario">Pídele a quien administra tu negocio que habilite el permiso de inventario.</rms-notice>
      }
      @if (error(); as message) {
        <rms-notice tone="danger" title="No se pudo continuar" dismissible (dismissed)="error.set(null)">{{ message }}</rms-notice>
      }

      <form [formGroup]="form" (ngSubmit)="save()" class="returns-form-stack" novalidate>
        @if (step() === 0) {
          <rms-panel title="¿Quién devuelve?" subtitle="Identifica al cliente en el kardex para poder rastrear la devolución.">
            <div class="rms-form-grid">
              <rms-field label="Nombre del cliente" span="full" required hint="Con este nombre queda documentada la devolución.">
                <input class="rms-input" formControlName="customerName" maxlength="150" aria-label="Nombre del cliente" placeholder="Ej. José Martínez" />
              </rms-field>
              <rms-field label="Número de estancia" optional hint="Si la devolución se asocia a una habitación ocupada.">
                <input class="rms-input" type="number" min="1" formControlName="roomStayId" aria-label="Número de estancia" placeholder="Ej. 128" />
              </rms-field>
            </div>
          </rms-panel>
          <rms-panel title="¿Desde qué caja se paga el reembolso?" subtitle="Si no eliges caja, el stock se corrige igual y el reembolso queda pendiente para el arqueo.">
            @if (cashOptions().length > 0) {
              <div class="rms-form-grid">
                <rms-field label="Caja para el reembolso" span="full">
                  <rms-combobox formControlName="cashBoxSessionId" [options]="cashOptions()" [loading]="cashLoading()" placeholder="Elegir turno abierto…"
                    emptyText="No hay turnos de caja abiertos" ariaLabel="Sesión de caja para el reembolso" />
                </rms-field>
              </div>
            } @else {
              <rms-notice tone="warning" title="La caja está cerrada">
                No hay turnos de caja abiertos. Puedes llevar el reembolso al arqueo del turno; el inventario se corrige igualmente.
              </rms-notice>
            }
          </rms-panel>
        } @else if (step() === 1) {
          <rms-panel title="¿Qué productos devuelve?" subtitle="El precio prellenado es el de venta del catálogo; ajusta el importe real devuelto.">
            <button type="button" class="rms-btn rms-btn--secondary returns-add" (click)="addLine()"><rms-cazo-icon name="plus" [size]="16" /> Agregar producto</button>
            <div class="returns-lines">
              @for (line of lines(); track line.productLineId) {
                <fieldset class="returns-line">
                  <legend>Producto</legend>
                  <div class="rms-form-grid">
                    <rms-field label="Producto" required span="full">
                      <rms-combobox [loader]="searchProducts" [selectedOptions]="productOptions().get(line.productLineId) ?? []"
                        placeholder="Busca un producto por nombre…" emptyText="No encontramos productos activos con ese nombre"
                        ariaLabel="Producto devuelto" (optionSelected)="productPicked(line.productLineId, $event)" />
                    </rms-field>
                    <rms-field label="Unidades que devuelve" required [hint]="productOf(line.productId)?.unitOfMeasure ?? null">
                      <input class="rms-input" type="number" inputmode="decimal" min="0" step="0.01" [value]="line.quantity"
                        (change)="setLineNumber(line.productLineId, 'quantity', $event)" aria-label="Unidades devueltas de la línea" />
                    </rms-field>
                    <rms-field label="Precio devuelto por unidad (C$)" required
                      hint="Total que se le devuelve al cliente por esa línea.">
                      <input class="rms-input" type="number" inputmode="decimal" min="0" step="0.01" [value]="line.unitPrice"
                        (change)="setLineNumber(line.productLineId, 'unitPrice', $event)" aria-label="Precio devuelto por unidad" />
                    </rms-field>
                  </div>
                  <button type="button" class="rms-btn rms-btn--ghost returns-line-remove" (click)="removeLine(line.productLineId)">
                    <rms-cazo-icon name="trash" [size]="16" /> Quitar línea
                  </button>
                </fieldset>
              } @empty {
                <p class="rms-muted returns-note">Agrega al menos un producto a la devolución.</p>
              }
            </div>
            <ul class="returns-review">
              <li><span>Dinero que se devuelve</span><strong>C$ {{ refundAmount() | number:'1.2-2' }}</strong></li>
            </ul>
          </rms-panel>
        } @else {
          <rms-panel title="Confirma la devolución" subtitle="Al guardar, el stock vuelve al inventario y el reembolso sale de la caja elegida.">
            <div class="rms-form-grid">
              <rms-field label="Motivo" optional span="full" hint="Qué pasó y en qué condición volvió el producto.">
                <input class="rms-input" formControlName="notes" maxlength="500" aria-label="Motivo de la devolución" placeholder="Ej. Producto sin abrir, se llevó el equivocado" />
              </rms-field>
            </div>
            <ul class="returns-review">
              @for (line of picked(); track line.productLineId) {
                <li><span>{{ line.quantity | number:'1.0-2' }} × {{ productOf(line.productId)?.name || 'Producto' }}</span><strong>C$ {{ line.quantity * line.unitPrice | number:'1.2-2' }}</strong></li>
              }
              <li><span>Cliente</span><strong>{{ form.controls.customerName.value?.trim() || 'Cliente sin nombre' }}</strong></li>
              <li><span>Caja</span><strong>{{ chosenCashLabel() }}</strong></li>
              <li class="returns-total"><span>Reembolso total</span><strong>C$ {{ refundAmount() | number:'1.2-2' }}</strong></li>
            </ul>
          </rms-panel>
        }
      </form>

      <aside aside>
        <rms-panel title="Resumen de la devolución" raised>
          <ul class="returns-summary">
            <li><span>Cliente</span><strong>{{ form.controls.customerName.value?.trim() || '—' }}</strong></li>
            <li><span>Productos</span><strong>{{ picked().length }}</strong></li>
            <li><span>Caja</span><strong>{{ chosenCashLabel() }}</strong></li>
          </ul>
          <div class="returns-delta" aria-live="polite">
            <div><small>Inventario</small><strong>Entra stock</strong></div>
            <div class="returns-delta__op"><small>Dinero</small><strong>Sale de caja</strong></div>
            <div><small>Reembolso</small><strong>C$ {{ refundAmount() | number:'1.2-2' }}</strong></div>
          </div>
        </rms-panel>
      </aside>

      <ng-container footer>
        <a class="rms-btn rms-btn--ghost" [routerLink]="backLink">Cancelar</a>
        @if (step() > 0) { <button type="button" class="rms-btn rms-btn--secondary" (click)="back()" [disabled]="saving()">Atrás</button> }
        @if (step() < 2) {
          <button type="button" class="rms-btn rms-btn--primary" (click)="next()" [disabled]="saving()">Continuar <rms-cazo-icon name="arrow-right" [size]="16" /></button>
        } @else {
          <button type="button" class="rms-btn rms-btn--primary" [disabled]="saving() || !network.online() || !canCreate()" (click)="save()">
            @if (saving()) { <span class="rms-spinner"></span> Registrando… } @else { <rms-cazo-icon name="check" [size]="16" /> Devolver el dinero }
          </button>
        }
      </ng-container>
    </rms-form-page>
  `,
  styles: `
    :host { display: block; }
    .returns-form-stack { display: grid; gap: 16px; }
    .returns-add { margin-bottom: 12px; }
    .returns-lines { display: grid; gap: 12px; }
    .returns-line { border: 1px solid var(--cazo-line); border-radius: var(--cazo-radius-sm); padding: 12px 14px; background: var(--cazo-soft); margin: 0; display: grid; gap: 10px; }
    .returns-line legend { color: var(--cazo-muted); font-size: 12px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; padding: 0 4px; }
    .returns-line-remove { justify-self: start; }
    .returns-note { font-size: 13px; }
    .returns-review, .returns-summary { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
    .returns-review li, .returns-summary li { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .returns-review span, .returns-summary span { color: var(--cazo-muted); }
    .returns-total { border-top: 1px solid var(--cazo-line); padding-top: 10px; font-size: 16px; }
    .returns-delta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; border-top: 1px solid var(--cazo-line); margin-top: 14px; padding-top: 12px; text-align: center; }
    .returns-delta small { display: block; color: var(--cazo-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnFormPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly products = inject(ProductService);
  private readonly customerReturns = inject(CustomerReturnService);
  private readonly cashBoxes = inject(CashBoxOperationsService);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionStore);
  protected readonly network = inject(NetworkStatusService);

  protected readonly backLink = '/admin/customer-returns';
  protected readonly step = signal(0);
  protected readonly reached = signal(0);
  protected readonly saving = signal(false);
  protected readonly loadingProds = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly tickValue = signal(0);
  private nextLineId = 1;
  protected readonly steps = [
    { id: 'customer', label: 'Cliente', description: 'Quién devuelve y desde qué caja' },
    { id: 'goods', label: 'Productos', description: 'Unidades y precio devuelto' },
    { id: 'confirm', label: 'Confirmar', description: 'Reembolso y motivo' },
  ];

  protected readonly form = this.formBuilder.group({
    customerName: ['', [Validators.required, Validators.maxLength(150)]],
    roomStayId: this.formBuilder.control<number | null>(null),
    cashBoxSessionId: this.formBuilder.control<number | null>(null),
    notes: ['', Validators.maxLength(500)],
  });

  protected readonly lines = signal<readonly ReturnLineForm[]>([]);
  private readonly productsById = signal<ReadonlyMap<number, Product>>(new Map());

  protected readonly openCashSessions = signal<readonly { readonly sessionId: number; readonly label: string }[]>([]);
  protected readonly cashLoading = signal(true);

  protected readonly cashOptions = computed<readonly ComboboxOption<number>[]>(() =>
    this.openCashSessions().map((row) => ({ value: row.sessionId, label: row.label })));
  protected readonly canCreate = computed(
    () => this.session.hasPermission('inventory:create') || this.session.hasPermission('inventory:movements'),
  );

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

  /** Solo las líneas con producto y unidades mayores a cero. */
  protected readonly picked = computed(() => {
    this.tickValue();
    return this.lines().filter((line) => line.productId > 0 && line.quantity > 0);
  });

  protected readonly refundAmount = computed(() => {
    this.tickValue();
    return round2(this.picked().reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  });

  protected readonly chosenCashLabel = computed(() => {
    const sessionId = this.form.controls.cashBoxSessionId.value;
    if (!sessionId) return 'Sin caja: queda pendiente al arqueo';
    return this.openCashSessions().find((row) => row.sessionId === sessionId)?.label ?? `Turno No. ${sessionId}`;
  });

  protected readonly searchProducts: ComboboxLoader<number> = (term) => this.products
    .list({ pageNumber: 1, pageSize: 20, name: term.trim(), categoryId: null, isActive: true })
    .pipe(
      map((page) => {
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

  protected addLine(): void {
    this.lines.update((current) => [...current, { productLineId: this.nextLineId++, productId: 0, quantity: 1, unitPrice: 0 }]);
    this.tickValue.update((value) => value + 1);
  }

  protected removeLine(productLineId: number): void {
    this.lines.update((current) => current.filter((line) => line.productLineId !== productLineId));
    this.tickValue.update((value) => value + 1);
  }

  protected productPicked(productLineId: number, option: ComboboxOption<number> | null): void {
    if (!option) {
      this.updateLine(productLineId, { productId: 0, unitPrice: 0 });
      this.tickValue.update((value) => value + 1);
      return;
    }
    const cached = this.productsById().get(option.value);
    if (cached) {
      this.updateLine(productLineId, { productId: cached.productId, unitPrice: cached.salePrice || 0 });
      this.tickValue.update((value) => value + 1);
      return;
    }
    this.loadingProds.set(true);
    this.products.getById(option.value)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingProds.set(false)))
      .subscribe({
        next: (product) => {
          if (product) {
            this.productsById.update((current) => new Map(current).set(product.productId, product));
            this.updateLine(productLineId, { productId: product.productId, unitPrice: product.salePrice || 0 });
          }
          this.tickValue.update((value) => value + 1);
        },
        error: (error: unknown) => this.error.set(describeApiError(error)),
      });
  }

  protected setLineNumber(productLineId: number, field: 'quantity' | 'unitPrice', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.updateLine(productLineId, { [field]: Number.isFinite(value) ? value : 0 });
    this.tickValue.update((value) => value + 1);
  }

  protected productOf(productId: number): Product | null {
    return this.productsById().get(productId) ?? null;
  }

  protected linesInvalid(): string | null {
    if (this.lines().length === 0) return 'Agrega al menos un producto a la devolución.';
    for (const line of this.lines()) {
      if (!line.productId) return 'Todas las líneas necesitan un producto.';
      if (!(line.quantity > 0)) return 'Escribe cuántas unidades devuelve en todas las líneas.';
      if (line.unitPrice < 0) return 'El precio devuelto no puede ser negativo.';
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
      this.form.controls.customerName.markAsTouched();
      const roomStayId = this.form.controls.roomStayId.value;
      if (!(this.form.controls.customerName.value ?? '').trim()) { this.error.set('Escribe el nombre del cliente.'); return; }
      if (this.form.controls.customerName.invalid) { this.error.set('El nombre del cliente supera los 150 caracteres.'); return; }
      if (roomStayId !== null && (!Number.isInteger(roomStayId) || roomStayId <= 0)) { this.error.set('Escribe un número de estancia válido o déjalo vacío.'); return; }
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
    this.form.controls.customerName.markAsTouched();
    if (!(this.form.controls.customerName.value ?? '').trim() || this.form.controls.customerName.invalid) {
      this.error.set('Escribe el nombre del cliente.');
      this.step.set(0);
      return;
    }
    if (this.linesInvalid()) { this.step.set(1); this.error.set(this.linesInvalid() ?? ''); return; }
    const value = this.form.getRawValue();
    const payload: CustomerReturnUpsert = {
      customerName: (value.customerName ?? '').trim(),
      roomStayId: value.roomStayId ?? null,
      cashBoxSessionId: value.cashBoxSessionId ?? null,
      notes: (value.notes ?? '').trim() || null,
      items: this.lines().map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice })),
    };
    this.saving.set(true);
    this.error.set(null);
    this.customerReturns.create(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (customerReturnId) => {
          this.products.invalidateCache();
          this.customerReturns.invalidateCache();
          this.toast.success('Devolución registrada', `Reembolso de C$ ${this.refundAmount().toFixed(2)} a ${payload.customerName}`);
          void this.router.navigateByUrl(this.backLink);
        },
        error: (error: unknown) => this.error.set(describeApiError(error)),
      });
  }

  private updateLine(productLineId: number, patch: Partial<Omit<ReturnLineForm, 'productLineId'>>): void {
    this.lines.update((current) => current.map((line) => (line.productLineId === productLineId ? { ...line, ...patch } : line)));
  }
}
