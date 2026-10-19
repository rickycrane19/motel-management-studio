import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, map, of } from 'rxjs';

import { describeApiError } from '../../../core/http/api-error';
import {
  ContractStatus,
  EmployeeContract,
  EmployeeContractQuery,
  EmployeeContractStats,
  EmployeeContractUpsert,
} from '../../../core/models/hr/contract.model';
import { ContractService } from '../../../core/services/hr/contract.service';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ContractsState {
  readonly status: LoadStatus;
  readonly query: EmployeeContractQuery;
  readonly contracts: readonly EmployeeContract[];
  readonly totalRecords: number;
  readonly stats: EmployeeContractStats;
  readonly errorMessage: string | null;
}

const INITIAL_QUERY: EmployeeContractQuery = {
  pageNumber: 1,
  pageSize: 20,
  search: '',
  paymentType: null,
  status: 'all',
};

const INITIAL_STATS: EmployeeContractStats = { active: 0, expiring: 0, expired: 0, ended: 0 };

/**
 * Estado del histórico de contratos. La búsqueda, la modalidad, el estado de
 * vigencia y la página los resuelve el SP; los contadores vienen con la página.
 */
@Injectable()
export class ContractsStore {
  private readonly contractsService = inject(ContractService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ContractsState>({
    status: 'idle',
    query: INITIAL_QUERY,
    contracts: [],
    totalRecords: 0,
    stats: INITIAL_STATS,
    errorMessage: null,
  });

  readonly status = computed(() => this.state().status);
  readonly query = computed(() => this.state().query);
  readonly contracts = computed(() => this.state().contracts);
  /** Filas de la página actual (el SP ya entregó solo esta ventana). */
  readonly pageRows = computed(() => this.state().contracts);
  readonly stats = computed(() => this.state().stats);
  readonly totalRecords = computed(() => this.state().totalRecords);
  readonly errorMessage = computed(() => this.state().errorMessage);
  readonly activeFilterCount = computed(() => {
    const query = this.state().query;
    return (query.search ? 1 : 0) + (query.paymentType !== null ? 1 : 0) + (query.status !== 'all' ? 1 : 0);
  });

  load(partialQuery: Partial<EmployeeContractQuery> = {}): void {
    const query: EmployeeContractQuery = { ...this.state().query, ...partialQuery, pageNumber: partialQuery.pageNumber ?? 1 };
    this.patch({ query, status: 'loading', errorMessage: null });
    this.contractsService
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.patch({ status: 'ready' })))
      .subscribe({
        next: (page) => this.patch({
          contracts: page.items,
          totalRecords: page.totalRecords,
          stats: page.stats,
        }),
        error: (error: unknown) => this.patch({ status: 'error', errorMessage: describeApiError(error) }),
      });
  }

  /** Cambia filtros y vuelve a pedir la primera página al SP. */
  patchFilters(filters: Partial<Omit<EmployeeContractQuery, 'pageNumber'>>): void {
    this.load({ ...filters, pageNumber: 1 });
  }

  goToPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  /** Guardar (crear o editar) y refrescar el historial. */
  save(contract: EmployeeContractUpsert, contractId: number | null): Observable<number | null> {
    const request$ = contractId
      ? this.contractsService.update(contractId, contract).pipe(map(() => contractId))
      : this.contractsService.create(contract);
    return request$;
  }

  /** Termina o reabre un contrato; falla con el mensaje del API listo para mostrar. */
  setActive(contractId: number, isActive: boolean): Observable<boolean> {
    return this.contractsService.setActive(contractId, isActive).pipe(
      map(() => {
        this.load();
        return true;
      }),
      catchError((error: unknown) => {
        this.patch({ errorMessage: describeApiError(error) });
        return of(false);
      }),
    );
  }

  private patch(partial: Partial<ContractsState>): void {
    this.state.update((current) => ({ ...current, ...partial }));
  }
}

export type { ContractStatus };
