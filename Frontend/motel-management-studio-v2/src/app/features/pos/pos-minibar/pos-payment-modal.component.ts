import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, effect, input, output, signal, viewChild } from '@angular/core';

import { DenominationItem, RoomStayDetail } from '../../../core/models/models';
import { CazoIconComponent, CazoIconName } from '../../../shared/ui/cazo-icon/cazo-icon.component';
import { PosMinibarCheckoutSubmission } from './pos-minibar.models';

interface CurrencyEquivalent {
  readonly currencyCode: string;
  readonly rate: number;
}

type MinibarPaymentMethod = 'Efectivo' | 'Tarjeta' | 'Mixto';

/**
 * Cobro de estancia (checkout) en El Rapidin. Port del modal de cobro del
 * restaurante v2 adaptado al modelo del motel: no hay métodos de pago
 * dinámicos ni multi-tender, solo Efectivo / Tarjeta / Mixto sobre el saldo
 * pendiente en NIO y un resumen informativo en divisas.
 */
@Component({
  selector: 'rms-pos-payment-modal',
  imports: [CurrencyPipe, DecimalPipe, CazoIconComponent],
  templateUrl: './pos-payment-modal.component.html',
  styleUrl: './pos-payment-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosPaymentModalComponent implements AfterViewInit {
  readonly stay = input<RoomStayDetail | null>(null);
  readonly roomLabel = input('Estancia');
  /** Divisas del mote (GET /api/finance/denominations): solo display informativo. */
  readonly currencyRates = input<readonly DenominationItem[]>([]);
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly confirmed = output<PosMinibarCheckoutSubmission>();

  protected readonly paymentMethods: readonly { readonly key: MinibarPaymentMethod; readonly icon: CazoIconName; readonly small: string }[] = [
    { key: 'Efectivo', icon: 'cash', small: 'C$ en caja' },
    { key: 'Tarjeta', icon: 'card', small: 'Débito u crédito' },
    { key: 'Mixto', icon: 'swap', small: 'Efectivo + tarjeta' },
  ];
  protected readonly quickAmounts = [500, 1000, 2000, 5000] as const;

  protected readonly selectedMethod = signal<MinibarPaymentMethod>('Efectivo');
  protected readonly paidAmount = signal(0);
  private readonly paidAmountTouched = signal(false);
  protected readonly notes = signal('');
  protected readonly validationMessage = signal<string | null>(null);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  protected readonly bill = computed(() => this.stay()?.stay ?? null);
  protected readonly totalAmount = computed(() => this.bill()?.totalAmount ?? 0);
  protected readonly paidBefore = computed(() => this.bill()?.paidAmount ?? 0);
  /** Saldo pendiente = totalAmount - paidAmount. */
  protected readonly pendingAmount = computed(() => Math.max(0, this.totalAmount() - this.paidBefore()));
  protected readonly paidValue = computed(() =>
    this.paidAmountTouched() ? Math.max(0, this.paidAmount() || 0) : this.pendingAmount());
  protected readonly overpaid = computed(() => this.paidValue() - this.pendingAmount() > 0.01);
  protected readonly changeAmount = computed(() => Math.max(0, this.paidValue() - this.pendingAmount()));
  protected readonly underpaidAmount = computed(() => Math.max(0, this.pendingAmount() - this.paidValue()));
  protected readonly canSubmit = computed(() =>
    this.bill() !== null && !this.submitting() && this.pendingAmount() > 0 && this.paidValue() > 0);
  protected readonly equivalents = computed<readonly CurrencyEquivalent[]>(() => {
    const seen = new Set<string>();
    const list: CurrencyEquivalent[] = [];
    for (const denomination of this.currencyRates()) {
      const code = denomination.currencyCode.toUpperCase();
      if (code === 'NIO' || seen.has(code) || !(denomination.exchangeRateToNIO > 0)) continue;
      seen.add(code);
      list.push({ currencyCode: code, rate: denomination.exchangeRateToNIO });
    }
    return list;
  });

  constructor() {
    // Al abrirse el modal con una nueva estancia, el monto vuelve al saldo pendiente.
    effect(() => {
      if (this.stay()) {
        this.paidAmount.set(0);
        this.paidAmountTouched.set(false);
        this.selectedMethod.set('Efectivo');
        this.notes.set('');
        this.validationMessage.set(null);
      }
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.dialog().nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  @HostListener('document:keydown.enter', ['$event'])
  protected confirmFromKeyboard(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.repeat) return;
    if (keyboardEvent.target instanceof HTMLElement
      && keyboardEvent.target.closest('input, select, textarea, button')) return;
    keyboardEvent.preventDefault();
    this.confirmPayment();
  }

  @HostListener('document:keydown.tab', ['$event'])
  protected keepFocusInside(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const focusable = Array.from(
      this.dialog().nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  protected methodIcon(method: MinibarPaymentMethod): CazoIconName {
    return this.paymentMethods.find((candidate) => candidate.key === method)?.icon ?? 'cash';
  }

  protected selectMethod(method: MinibarPaymentMethod): void {
    this.selectedMethod.set(method);
    this.validationMessage.set(null);
  }

  protected updatePaid(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.paidAmount.set(Number.isFinite(value) ? Math.max(0, value) : 0);
    this.paidAmountTouched.set(true);
    this.validationMessage.set(null);
  }

  protected setQuickAmount(amount: number): void {
    this.paidAmount.set(amount);
    this.paidAmountTouched.set(true);
    this.validationMessage.set(null);
  }

  protected updateNotes(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
    this.validationMessage.set(null);
  }

  protected confirmPayment(): void {
    if (this.submitting()) return;
    if (this.paidValue() <= 0) {
      this.validationMessage.set('El monto pagado debe ser mayor que cero.');
      return;
    }
    this.validationMessage.set(null);
    this.confirmed.emit({
      paidAmount: this.paidValue(),
      paymentMethod: this.selectedMethod(),
      notes: this.notes(),
    });
  }
}
