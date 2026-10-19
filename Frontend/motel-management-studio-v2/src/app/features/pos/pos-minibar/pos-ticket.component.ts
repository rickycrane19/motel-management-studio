import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CazoIconComponent } from '../../../shared/ui/cazo-icon/cazo-icon.component';
import { ComboboxComponent, ComboboxOption } from '../../../shared/ui/combobox/combobox.component';
import { PosMinibarCartLine, PosMinibarQuantityChange, posMinibarProductImage } from './pos-minibar.models';

@Component({
  selector: 'rms-pos-ticket',
  imports: [CurrencyPipe, CazoIconComponent, ComboboxComponent, FormsModule],
  templateUrl: './pos-ticket.component.html',
  styleUrl: './pos-ticket.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosTicketComponent {
  /** Carrito del minibar: SOLO un carrito de productos, con destino de habitación. */
  readonly lines = input.required<readonly PosMinibarCartLine[]>();
  readonly total = input.required<number>();
  readonly currencyCode = input('NIO');
  readonly saving = input(false);
  readonly destinationRoomStayId = input<number | null>(null);
  readonly destinationLabel = input<string | null>(null);
  readonly roomsOpen = input(0);
  readonly roomOptions = input<readonly ComboboxOption<string>[]>([]);

  readonly quantityChange = output<PosMinibarQuantityChange>();
  readonly removed = output<number>();
  readonly noteChanged = output<{ readonly productId: number; readonly note: string }>();
  readonly cleared = output<void>();
  readonly destinationChange = output<number | null>();
  readonly checkout = output<void>();

  protected readonly itemCount = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  protected readonly canSubmit = computed(() =>
    this.lines().length > 0 && this.destinationRoomStayId() !== null && !this.saving());

  protected lineTotal(line: PosMinibarCartLine): number {
    return line.product.salePrice * line.quantity;
  }

  protected image(line: PosMinibarCartLine): string {
    return posMinibarProductImage(line.product);
  }

  /** Aviso de stock: la cantidad del carrito supera lo que hoy reporta el catálogo. */
  protected exceedsStock(line: PosMinibarCartLine): boolean {
    return line.quantity > line.product.currentStock;
  }

  protected stockHint(line: PosMinibarCartLine): string {
    return `Solo quedan ${line.product.currentStock} ${line.product.unitOfMeasure} en stock hoy`;
  }

  protected updateNote(line: PosMinibarCartLine, event: Event): void {
    this.noteChanged.emit({ productId: line.product.productId, note: (event.target as HTMLTextAreaElement).value });
  }

  protected onDestinationChange(raw: string | number | null): void {
    const value = Number(raw);
    this.destinationChange.emit(Number.isSafeInteger(value) && value > 0 ? value : null);
  }

  protected changeQuantity(line: PosMinibarCartLine, delta: number): void {
    if (delta > 0 && line.quantity >= line.product.currentStock) return;
    this.quantityChange.emit({ productId: line.product.productId, delta });
  }
}
