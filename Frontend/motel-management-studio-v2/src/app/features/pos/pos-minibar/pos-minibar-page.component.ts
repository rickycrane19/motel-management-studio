import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, concatMap, debounceTime, finalize, from, map, of, toArray } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { DenominationItem, RoomItem, RoomStayDetail } from '../../../core/models/models';
import { Product } from '../../../core/models/inventory/product.model';
import { ApiService } from '../../../core/services/api.service';
import { ProductService } from '../../../core/services/inventory/product.service';
import { CategoryService } from '../../../core/services/inventory/category.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { CazoIconComponent } from '../../../shared/ui/cazo-icon/cazo-icon.component';
import { ComboboxComponent, ComboboxOption } from '../../../shared/ui/combobox/combobox.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { PosPaymentModalComponent } from './pos-payment-modal.component';
import { PosTicketComponent } from './pos-ticket.component';
import {
  PosMinibarCartLine,
  PosMinibarCheckoutSubmission,
  PosMinibarQuantityChange,
  posMinibarIsSellable,
  posMinibarProductImage,
} from './pos-minibar.models';

interface ConsumptionResult {
  readonly productName: string;
  readonly errorMessage: string | null;
}

/** Tope de filas del SP de productos por página en el minibar. */
const POS_PAGE_SIZE = 200;

@Component({
  selector: 'rms-pos-minibar-page',
  imports: [CurrencyPipe, FormsModule, ReactiveFormsModule, CazoIconComponent, ComboboxComponent, PosTicketComponent, PosPaymentModalComponent],
  templateUrl: './pos-minibar-page.component.html',
  styleUrl: './pos-minibar-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosMinibarPageComponent {
  private readonly productsService = inject(ProductService);
  private readonly categoriesService = inject(CategoryService);
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly searchTerm = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly categoryOptions = signal<readonly ComboboxOption<number>[]>([]);

  protected readonly catalog = signal<readonly Product[]>([]);
  protected readonly catalogTotal = signal(0);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly rooms = signal<readonly RoomItem[]>([]);
  protected readonly roomsLoading = signal(false);
  protected readonly roomsError = signal<string | null>(null);

  protected readonly cart = signal<readonly PosMinibarCartLine[]>([]);
  protected readonly loadingCart = signal(false);
  protected readonly surfaceNotice = signal<string | null>(null);

  protected readonly destinationRoomStayId = signal<number | null>(null);
  protected readonly currencyRates = signal<readonly DenominationItem[]>([]);

  /** Cobro de la estancia de destino. */
  protected readonly paymentOpen = signal(false);
  protected readonly paymentStay = signal<RoomStayDetail | null>(null);
  protected readonly paymentLoading = signal(false);
  protected readonly paymentError = signal<string | null>(null);
  protected readonly checkoutSubmitting = signal(false);

  protected readonly openRooms = computed(() =>
    this.rooms().filter((room) => room.currentRoomStayId != null));
  protected readonly roomOptions = computed<readonly ComboboxOption<string>[]>(() =>
    this.openRooms().map((room) => ({
      value: String(room.currentRoomStayId),
      label: `Hab. ${room.roomNumber}`,
      hint: [room.customerName?.trim() || 'Cliente anónimo', room.roomTypeName].filter(Boolean).join(' · '),
    })));
  protected readonly destinationRoom = computed(() =>
    this.openRooms().find((room) => room.currentRoomStayId === this.destinationRoomStayId()) ?? null);
  protected readonly destinationLabel = computed(() => {
    const room = this.destinationRoom();
    return room ? `Hab. ${room.roomNumber}` : null;
  });
  protected readonly canLoadCart = computed(() =>
    this.cart().length > 0 && this.destinationRoomStayId() !== null && !this.loadingCart());
  protected readonly canCheckoutStay = computed(() =>
    this.destinationRoomStayId() !== null && !this.paymentLoading() && !this.checkoutSubmitting());
  protected readonly catalogCount = computed(() => this.filteredProducts().length);
  /** La búsqueda y la categoría se resuelven en el SP; queda saber si hay más páginas. */
  protected readonly catalogHasMore = computed(() => this.catalog().length < this.catalogTotal());
  protected readonly cartTotal = computed(() =>
    this.cart().reduce((total, line) => total + line.product.salePrice * line.quantity, 0));

  protected readonly filteredProducts = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const categoryId = this.categoryId();
    return this.catalog()
      .map((product): Product => ({ ...product, imageUrl: product.imageUrl ?? null }))
      .filter((product) => posMinibarIsSellable(product))
      .filter((product) => (categoryId === null ? true : product.categoryId === categoryId))
      .filter((product) => (term
        ? product.name.toLocaleLowerCase().includes(term)
          || product.code.toLocaleLowerCase().includes(term)
          || (product.categoryName.trim() || '').toLocaleLowerCase().includes(term)
        : true));
  });

  protected readonly productImage = posMinibarProductImage;

  constructor() {
    this.loadCatalog();
    this.loadRooms();
    this.loadCategoryOptions();
    this.loadCurrencyRates();

    this.search.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.loadCatalog();
      });

    this.realtime.inventoryChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.loadCatalog() });
    this.realtime.roomsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.loadRooms() });
  }

  /**
   * Catálogo del minibar paginado en el servidor. La búsqueda y la categoría viajan
   * al SP; «cargar más» pide la página siguiente y acumula (nadie baja 5 000 filas).
   */
  protected loadCatalog(reset = true): void {
    this.loading.set(true);
    const pageSize = 50;
    const pageNumber = reset ? 1 : Math.floor(this.catalog().length / pageSize) + 1;
    this.productsService
      .list({
        pageNumber,
        pageSize,
        name: this.searchTerm(),
        categoryId: this.categoryId(),
        isActive: true,
      })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.errorMessage.set(null);
          this.catalogTotal.set(page.totalRecords);
          this.catalog.set(reset ? page.items : [...this.catalog(), ...page.items]);
        },
        error: (error: unknown) => this.errorMessage.set(describeApiError(error)),
      });
  }

  protected loadMoreCatalog(): void {
    if (this.loading() || !this.catalogHasMore()) return;
    this.loadCatalog(false);
  }

  private loadCategoryOptions(): void {
    this.categoriesService.listActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categoryOptions.set(
          categories.map((category) => ({ value: category.categoryId, label: category.name }))),
        error: () => this.categoryOptions.set([]),
      });
  }

  protected loadRooms(): void {
    this.roomsLoading.set(true);
    this.api.getRooms()
      .pipe(finalize(() => this.roomsLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rooms) => {
          this.rooms.set(rooms);
          this.roomsError.set(null);
          const destinationId = this.destinationRoomStayId();
          if (destinationId !== null && !rooms.some((room) => room.currentRoomStayId === destinationId)) {
            this.destinationRoomStayId.set(null);
          }
        },
        error: (error: unknown) => this.roomsError.set(describeApiError(error)),
      });
  }

  private loadCurrencyRates(): void {
    this.api.getDenominations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (denominations) => this.currencyRates.set(denominations),
        error: () => this.currencyRates.set([]),
      });
  }

  protected setCategory(categoryId: number | null): void {
    this.categoryId.set(categoryId ?? null);
    this.loadCatalog();
  }

  /** Solo entra al carrito producto con stock e imagen/placeholder compartidos. */
  protected addProduct(product: Product): void {
    if (!posMinibarIsSellable(product)) return;
    this.cart.update((lines) => {
      const existing = lines.find((line) => line.product.productId === product.productId);
      return existing
        ? lines.map((line) => line.product.productId === product.productId
          ? { ...line, quantity: line.quantity + 1 }
          : line)
        : [...lines, { product, quantity: 1, note: '' }];
    });
  }

  protected changeQuantity(change: PosMinibarQuantityChange): void {
    this.cart.update((lines) =>
      lines
        .map((line) => line.product.productId === change.productId
          ? { ...line, quantity: Math.max(0, line.quantity + change.delta) }
          : line)
        .filter((line) => line.quantity > 0),
    );
  }

  protected removeLine(productId: number): void {
    this.cart.update((lines) => lines.filter((line) => line.product.productId !== productId));
  }

  protected changeLineNote(productId: number, note: string): void {
    this.cart.update((lines) => lines.map((line) =>
      line.product.productId === productId ? { ...line, note } : line));
  }

  protected clearCart(): void {
    this.cart.set([]);
  }

  @HostListener('document:keydown.f8', ['$event'])
  protected loadCartFromKeyboard(event: Event): void {
    event.preventDefault();
    this.loadCart();
  }

  /** Un consumo por línea, en secuencia; los fallos se reportan línea por línea. */
  protected loadCart(): void {
    if (this.loadingCart() || !this.cart().length) return;
    const roomStayId = this.destinationRoomStayId();
    if (roomStayId === null) {
      this.surfaceNotice.set(this.openRooms().length === 0
        ? 'Abre un servicio para cargar el minibar.'
        : 'Elige la habitación abierta a la que se carga el carrito.');
      return;
    }

    this.loadingCart.set(true);
    this.surfaceNotice.set(null);
    const lines = this.cart();
    from(lines)
      .pipe(
        concatMap((line) => this.api
          .addStayConsumption(roomStayId, {
            productId: line.product.productId,
            quantity: line.quantity,
            notes: line.note.trim() || undefined,
          })
          .pipe(
            map((): ConsumptionResult => ({ productName: line.product.name, errorMessage: null })),
            catchError((error: unknown): Observable<ConsumptionResult> =>
              of({ productName: line.product.name, errorMessage: this.describeError(error) })),
          )),
        toArray(),
        finalize(() => this.loadingCart.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (results) => {
          const failures = results.filter((result): result is ConsumptionResult & { readonly errorMessage: string } =>
            result.errorMessage !== null);
          if (failures.length > 0) {
            this.surfaceNotice.set(failures.length === 1
              ? `${failures[0].productName}: ${failures[0].errorMessage}`
              : `No se pudieron cargar ${failures.length} líneas. La primera falló en ${failures[0].productName}: ${failures[0].errorMessage}`);
            this.loadRooms();
            return;
          }
          const room = this.destinationRoom();
          this.cart.set([]);
          this.toast.success(
            'Minibar cargado',
            `Consumos agregados a la cuenta de ${room ? `la habitación ${room.roomNumber}` : 'la estancia'}.`,
          );
          this.loadRooms();
        },
        error: (error: unknown) => this.surfaceNotice.set(this.describeError(error)),
      });
  }

  /** Abre el modal de cobro con el resumen de cuenta de la estancia de destino. */
  protected openPayment(): void {
    const roomStayId = this.destinationRoomStayId();
    if (roomStayId === null || this.paymentLoading()) return;
    this.paymentLoading.set(true);
    this.paymentError.set(null);
    this.api.getRoomStayDetail(roomStayId)
      .pipe(finalize(() => this.paymentLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.paymentStay.set(detail);
          this.paymentOpen.set(true);
        },
        error: (error: unknown) => this.paymentError.set(this.describeError(error)),
      });
  }

  protected closePayment(): void {
    if (this.checkoutSubmitting()) return;
    this.paymentOpen.set(false);
    this.paymentStay.set(null);
    this.paymentError.set(null);
  }

  /** POST /api/service/stays/{id}/checkout (204) →  toast y refresco de habitaciones. */
  protected onCheckoutConfirmed(submission: PosMinibarCheckoutSubmission): void {
    const stay = this.paymentStay();
    if (!stay || this.checkoutSubmitting()) return;
    this.checkoutSubmitting.set(true);
    this.paymentError.set(null);
    this.api.checkoutRoomStay(stay.stay.roomStayId, {
      paidAmount: submission.paidAmount,
      paymentMethod: submission.paymentMethod,
      notes: submission.notes.trim() || undefined,
    })
      .pipe(finalize(() => this.checkoutSubmitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.paymentOpen.set(false);
          this.paymentStay.set(null);
          this.destinationRoomStayId.set(null);
          this.toast.success('Estancia cobrada', 'El cobro quedó registrado y se liberó la habitación.');
          this.loadRooms();
        },
        error: (error: unknown) => this.paymentError.set(this.describeError(error)),
      });
  }

  private describeError(error: unknown): string {
    return describeApiError(error);
  }
}
