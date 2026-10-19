import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { CloudinaryService } from '../cloudinary.service';
import { environment } from '../../../../environments/environment';
import {
  Product,
  ProductPage,
  ProductQuery,
  ProductStats,
  ProductUpsert,
} from '../../models/inventory/product.model';

/**
 * Servicio de productos del minibar de El Rapidin.
 *
 * El backend pagina en servidor (RT-05): la búsqueda, la categoría, el estado y
 * la página se envían al SP; el cliente nunca carga el catálogo completo para
 * paginar. Las tarjetas de estadísticas se piden a un resumen ligero.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly endpoint = `${environment.apiUrl}/api/inventory`;

  list(query: ProductQuery): Observable<ProductPage> {
    const params = new HttpParams()
      .set('search', query.name.trim())
      .set('page', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));
    if (query.isActive !== null) params.set('onlyActive', String(query.isActive));
    if (query.categoryId !== null) params.set('categoryId', String(query.categoryId));
    return this.http.get<ProductPage>(`${this.endpoint}/products`, { params }).pipe(
      map((page) => ({ ...page, items: page.items.map((item) => this.normalize(item)) })),
    );
  }

  stats(): Observable<ProductStats> {
    return this.http.get<ProductStats>(`${this.endpoint}/products/stats`);
  }

  getById(productId: number): Observable<Product | null> {
    return this.http
      .get<Product>(`${this.endpoint}/products/${productId}`)
      .pipe(map((item) => this.normalize(item)), catchError(() => of(null)));
  }

  create(product: ProductUpsert): Observable<number> {
    return this.resolveImageUrl(product).pipe(
      switchMap((imageUrl) => this.http.post<number>(`${this.endpoint}/products`, this.toBody(product, imageUrl))),
    );
  }

  update(product: ProductUpsert & { readonly id: number }): Observable<void> {
    return this.resolveImageUrl(product).pipe(
      switchMap((imageUrl) =>
        this.http.put<void>(`${this.endpoint}/products/${product.id}`, this.toBody(product, imageUrl, true)),
      ),
    );
  }

  setActive(productId: number, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.endpoint}/products/${productId}/set-active`, { productId, isActive });
  }

  /**
   * Sin caché local (la paginación vive en el servidor). Se conserva como no-op
   * para no tocar a los formularios que aún la invocan tras guardar.
   */
  invalidateCache(): void {
    // Intencionalmente vacío: ya no hay catálogo en memoria.
  }

  private normalize(item: Product): Product {
    return { ...item, imageUrl: item.imageUrl ?? null };
  }

  private resolveImageUrl(product: ProductUpsert): Observable<string | null> {
    if (!product.imageFile) return of(product.imageUrl?.trim() || null);
    return this.cloudinary.uploadImage(product.imageFile).pipe(
      map((result) => {
        const url = result.secureUrl?.trim() || result.url?.trim() || null;
        // La baseURL local no debe guardarse: la imagen se conserva solo en la sesión.
        return url && /^https?:/i.test(url) ? url : null;
      }),
    );
  }

  private toBody(product: ProductUpsert, imageUrl: string | null, includeStockUpdate = false) {
    const body: Record<string, unknown> = {
      categoryId: product.categoryId,
      code: product.code.trim(),
      name: product.name.trim(),
      description: product.description?.trim() || null,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      minStock: product.minStock,
      unitOfMeasure: product.unitOfMeasure.trim() || 'UND',
      imageUrl: imageUrl?.trim() || null,
    };
    if (!includeStockUpdate) {
      body['currentStock'] = product.currentStock;
    }
    return body;
  }
}
