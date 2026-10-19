import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, Observable, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  CommissionRule,
  CommissionRuleQuery,
  CommissionRuleUpsert,
} from '../../../core/models/hr/commission-rule.model';
import { CommissionRuleService } from '../../../core/services/hr/commission-rule.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CommissionRulesState {
  readonly status: LoadStatus;
  readonly query: CommissionRuleQuery;
  readonly rules: readonly CommissionRule[];
  readonly totalRecords: number;
  readonly errorMessage: string | null;
  readonly saving: boolean;
}

const INITIAL_QUERY: CommissionRuleQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  onlyActive: null,
  scopeType: null,
  metricType: null,
};

/** Estado del catálogo de reglas de comisión (paginado en el servidor). */
@Injectable()
export class CommissionRulesStore {
  private readonly service = inject(CommissionRuleService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<CommissionRulesState>({
    status: 'idle',
    query: INITIAL_QUERY,
    rules: [],
    totalRecords: 0,
    errorMessage: null,
    saving: false,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly rules = computed(() => this.state().rules);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly saving = computed(() => this.state().saving);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.onlyActive !== null ? 1 : 0) + (query.scopeType ? 1 : 0) + (query.metricType ? 1 : 0);
  });

  load(partialQuery: Partial<CommissionRuleQuery> = {}): void {
    const query: CommissionRuleQuery = {
      ...this.state().query,
      ...partialQuery,
      pageNumber: partialQuery.pageNumber ?? 1,
    };
    this.patch({ query, status: 'loading', errorMessage: null });
    this.service
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (page) => this.patch({ rules: page.items, totalRecords: page.totalRecords }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  applyFilters(filters: Partial<CommissionRuleQuery>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  save(rule: CommissionRuleUpsert, ruleId: number | null): Observable<boolean> {
    this.patch({ saving: true, errorMessage: null });
    const request$ = ruleId === null
      ? this.service.create(rule).pipe(map(() => undefined))
      : this.service.update(ruleId, rule);
    return request$.pipe(
      finalize(() => this.patch({ saving: false })),
      map(() => true),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  toggleActive(rule: CommissionRule): void {
    this.patch({ errorMessage: null });
    this.service
      .setActive(rule.ruleId, !rule.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load({ pageNumber: this.state().query.pageNumber }),
        error: (error: unknown) => this.patch({ errorMessage: describeApiError(error) }),
      });
  }

  private patch(partial: Partial<CommissionRulesState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}
