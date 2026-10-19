/** Reglas de comisión de El Rapidin (modelo alineado al backend motel). */

export type CommissionScope = 'Employee' | 'Position' | 'All';
export type CommissionMetric = 'Sales' | 'Stays' | 'Products' | 'Tips';

export interface CommissionRule {
  ruleId: number;
  tenantId: string;
  name: string;
  scopeType: CommissionScope;
  scopeTypeName: string;
  employeeId: number | null;
  employeeName: string | null;
  employeePosition: string | null;
  position: string | null;
  targetLabel: string;
  metricType: CommissionMetric;
  metricTypeName: string;
  /** Inicio del tramo (inclusive). */
  minAmount: number;
  /** Fin del tramo (exclusivo); null = sin tope. */
  maxAmount: number | null;
  ratePercent: number;
  /** Clave AAAA-MM-DD. */
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  createdOn: string;
  createdBy: number | null;
}

export interface CommissionRulePage {
  items: readonly CommissionRule[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface CommissionRuleQuery {
  pageNumber: number;
  pageSize: number;
  search: string;
  onlyActive: boolean | null;
  scopeType: CommissionScope | null;
  metricType: CommissionMetric | null;
}

export interface CommissionRuleUpsert {
  name: string;
  scopeType: CommissionScope;
  metricType: CommissionMetric;
  minAmount: number;
  maxAmount: number | null;
  ratePercent: number;
  /** Clave AAAA-MM-DD. */
  startDate: string;
  endDate: string | null;
  employeeId: number | null;
  position: string | null;
  notes: string | null;
}
