import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import { Product, ProductQuery, ProductStats, ProductUpsert } from '../../../core/models/inventory/product.model';
import { ProductService } from '../../../core/services/inventory/product.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ProductsState {
  readonly status: LoadStatus;
  readonly query: ProductQuery;
  readonly products: readonly Product[];
  readonly totalRecords: number;
  readonly stats: ProductStats;
  readonly errorMessage: string | null;
  readonly saving: boolean;
  readonly busyProductId: number | null;
}

const INITIAL_QUERY: ProductQuery = {
  pageNumber: 1,
  pageSize: 10,
  name: '',
  categoryId: null,
  isActive: null,
};

const INITIAL_STATS: ProductStats = { total: 0, active: 0, inactive: 0, lowStock: 0 };

@Injectable()
export class ProductsStore {
  private readonly productsService = inject(ProductService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ProductsState>({
    status: 'idle',
    query: INITIAL_QUERY,
    products: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
    saving: false,
    busyProductId: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly products = computed(() => this.state().products);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly stats = computed(() => this.state().stats);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly busyProductId = computed(() => this.state().busyProductId);

  load(partialQuery: Partial<ProductQuery> = {}): void {
    const query: ProductQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    forkJoin({
      page: this.productsService.list(query),
      stats: this.productsService.stats(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: ({ page, stats }) => this.patch({
          products: page.items,
          totalRecords: page.totalRecords,
          query: { ...query, pageNumber: page.page, pageSize: page.pageSize },
          stats,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<ProductQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  resetFilters(): void {
    this.load({ name: '', categoryId: null, isActive: null, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  setActive(product: Product, isActive: boolean): Observable<boolean> {
    this.patch({ busyProductId: product.productId, errorMessage: null });
    return this.productsService.setActive(product.productId, isActive).pipe(
      finalize(() => this.patch({ busyProductId: null })),
      map(() => {
        // El catálogo vive en el servidor: recarga la página actual para reflejar el cambio.
        this.load({ pageNumber: this.state().query.pageNumber });
        return true;
      }),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  save(product: ProductUpsert): Observable<unknown> {
    this.patch({ saving: true, errorMessage: null });
    const request: Observable<unknown> = product.id !== null
      ? this.productsService.update(product as ProductUpsert & { readonly id: number })
      : this.productsService.create(product);
    return request.pipe(
      finalize(() => this.patch({ saving: false })),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        throw error;
      }),
    );
  }

  private patch(partial: Partial<ProductsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
