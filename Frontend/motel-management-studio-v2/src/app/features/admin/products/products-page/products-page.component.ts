import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { NetworkStatusService } from '../../../../core/browser/network-status.service';
import { Product } from '../../../../core/models/inventory/product.model';
import { CategoryService } from '../../../../core/services/inventory/category.service';
import { csvDocument } from '../../../../shared/export/safe-csv';
import { productPresentationImage } from '../../../../shared/presentation/product-presentation';
import {
  CazoIconComponent,
  ComboboxComponent,
  ComboboxOption,
  ConfirmDialogService,
  DrawerComponent,
  FilterBarComponent,
  NoticeComponent,
  PageHeaderComponent,
  PagerComponent,
  StatCardComponent,
  StatusBadgeComponent,
  ToastService,
} from '../../../../shared/ui';
import { ProductsStore } from '../products.store';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'rms-products-page',
  imports: [
    ReactiveFormsModule, DecimalPipe, RouterLink, CazoIconComponent, ComboboxComponent,
    DrawerComponent, FilterBarComponent, NoticeComponent, PageHeaderComponent, PagerComponent, StatCardComponent, StatusBadgeComponent,
  ],
  providers: [ProductsStore],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPageComponent implements OnInit {
  protected readonly store = inject(ProductsStore);
  protected readonly network = inject(NetworkStatusService);
  protected readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoriesService = inject(CategoryService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly categories = signal<readonly ComboboxOption<number>[]>([]);
  protected readonly selected = signal<Product | null>(null);
  protected readonly categoryControl = new FormControl<number | null>(null);
  protected readonly statusControl = new FormControl<StatusFilter>('all', { nonNullable: true });
  protected readonly statusOptions: readonly ComboboxOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Visibles en el catálogo' },
    { value: 'inactive', label: 'Ocultos' },
  ];
  protected readonly pageSizes = [10, 20, 50, 100, 200] as const;
  protected readonly trackProduct = (row: Product): number => row.productId;
  protected readonly money = (amount: number): string => `C$ ${amount.toFixed(2)}`;

  protected readonly canCreate = computed(() => this.session.hasPermission('inventory:create'));
  protected readonly canUpdate = computed(() => this.session.hasPermission('inventory:update'));
  protected readonly activeFilters = computed(() => {
    const query = this.store.query();
    return (query.categoryId !== null ? 1 : 0) + (query.isActive !== null ? 1 : 0);
  });
  protected readonly tableError = computed(() => (this.store.status() === 'error' ? this.store.errorMessage() : null));

  ngOnInit(): void {
    this.categoriesService.listActive().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (categories) => this.categories.set(categories.map((category) => ({ value: category.categoryId, label: category.name }))),
      error: () => this.toast.warning('No pudimos cargar las categorías', 'El filtro por categoría no está disponible por ahora.'),
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.store.load({ name: params.get('name')?.trim() ?? '', pageNumber: 1 });
    });
    this.categoryControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
  }

  protected onSearch(term: string): void {
    this.store.applyFilters({ ...this.currentFilters(), name: term });
  }

  protected clearFilters(): void {
    this.categoryControl.setValue(null, { emitEvent: false });
    this.statusControl.setValue('all', { emitEvent: false });
    this.store.resetFilters();
  }

  private applyFilters(): void {
    this.store.applyFilters(this.currentFilters());
  }

  private currentFilters() {
    const status = this.statusControl.value;
    return {
      name: this.store.query().name,
      categoryId: this.categoryControl.value,
      isActive: status === 'all' ? null : status === 'active',
    };
  }

  protected setPageSize(size: number): void {
    this.store.load({ pageSize: size, pageNumber: 1 });
  }

  protected open(product: Product): void {
    this.selected.set(product);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  protected async toggleStatus(product: Product): Promise<void> {
    if (!this.network.online()) return;
    const hiding = product.isActive;
    const accepted = await this.confirm.ask({
      title: hiding ? 'Ocultar producto' : 'Mostrar producto',
      message: hiding
        ? 'Dejará de aparecer en el minibar del POS. No se borra: puedes mostrarlo otra vez cuando quieras.'
        : 'Volverá a aparecer en el catálogo de tu motel.',
      detail: product.name,
      confirmLabel: hiding ? 'Ocultar' : 'Mostrar',
      tone: hiding ? 'warning' : 'primary',
    });
    if (!accepted) return;
    this.store.setActive(product, !product.isActive).subscribe((done) => {
      if (!done) { this.toast.error('No se pudo cambiar el estado', this.store.errorMessage() ?? 'Inténtalo de nuevo en unos segundos.'); return; }
      this.toast.success(hiding ? 'Producto oculto' : 'Producto visible', product.name);
      this.selected.set(null);
    });
  }

  protected productImage(product: Product): string {
    return productPresentationImage(product);
  }

  protected stockLabel(product: Product): string {
    return `${product.currentStock} ${product.unitOfMeasure} en stock`;
  }

  protected exportCurrentPage(): void {
    const columns = ['Código', 'Nombre', 'Categoría', 'Precio venta', 'Stock', 'Estado'];
    const rows = this.store.products().map((product) => [
      product.code, product.name, product.categoryName, product.salePrice, product.currentStock, product.isActive ? 'Visible' : 'Oculto',
    ]);
    const url = URL.createObjectURL(new Blob([csvDocument([columns, ...rows])], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `productos-pagina-${this.store.query().pageNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
