import { Product } from '../../../core/models/inventory/product.model';

/** Producto vendible del minibar tal como lo entrega el catálogo del motel. */
export type PosMinibarProduct = Product;

/** Línea del carrito de productos (un solo carrito: no hay mesa, solo destino). */
export interface PosMinibarCartLine {
  readonly product: PosMinibarProduct;
  readonly quantity: number;
  /** Nota libre que viaja como `notes` del consumo en el POST por línea. */
  readonly note: string;
}

export interface PosMinibarQuantityChange {
  readonly productId: number;
  readonly delta: number;
}

/** Cuerpo de confirmación del cobro de la estancia (checkout). */
export interface PosMinibarCheckoutSubmission {
  readonly paidAmount: number;
  readonly paymentMethod: 'Efectivo' | 'Tarjeta' | 'Mixto';
  readonly notes: string;
}

export function posMinibarProductImage(product: PosMinibarProduct): string {
  // Mismo placeholder compartido del design system: /assets/products/no-photo.svg.
  return product.imageUrl?.trim() || '/assets/products/no-photo.svg';
}

/** `currentStock > 0 && isActive` son las únicas condiciones del minibar del POS. */
export function posMinibarIsSellable(product: PosMinibarProduct): boolean {
  return product.isActive && product.currentStock > 0;
}
