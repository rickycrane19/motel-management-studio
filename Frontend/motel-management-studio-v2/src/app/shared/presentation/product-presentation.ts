/** Imagen de presentación de producto: usa la URL guardada o un placeholder neutro. */
export const PRODUCT_IMAGE_PLACEHOLDER = '/assets/products/no-photo.svg';

export function productPresentationImage(product: { imageUrl?: string | null }): string {
  return product.imageUrl?.trim() || PRODUCT_IMAGE_PLACEHOLDER;
}
