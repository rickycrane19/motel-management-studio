/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetFinancialSummary]
   SUBDOMAIN:   Reports
   DESCRIPTION: Resumen financiero consolidado del período [FromUtc, ToUtc). Un único SELECT
                cuyos bloques se leen DIRECTO por fuente (nunca vía ajustes de caja):
                  · Ingresos: estancias cerradas/cobradas (tarifa base + extensiones), minibar
                    vendido en estancias (RoomStayConsumption, ya cobrado en el check-out) y
                    multas cobradas (RoomStayFine no condonadas).
                  · Egresos: compras del kardex (MovimientoType 'Compra'), devoluciones a
                    cliente ('DevolucionCliente'), nómina (EmployeePayment) y pérdidas
                    (FinancialLoss). Recupero por devoluciones a proveedor ('DevolucionProveedor')
                    se lista aparte como reembolso, no como egreso.
                  · Ajustes manuales de caja: solo ajustes con SourceCode = 'AjusteManual'
                    ('Compra','Proveedor','Cliente','Nomina','Perdida' se leen por su fuente,
                    evitando doble conteo); el ajuste manual OUT responde solo al ajuste
                    manual de caja POST /sessions/{id}/adjustments.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetFinancialSummary] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2,
    @ToUtc    DATETIME2
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        @FromUtc  AS FromUtc,
        @ToUtc    AS ToUtc,
        [Configuration].[fnToManaguaTime](@FromUtc) AS FromManagua,
        [Configuration].[fnToManaguaTime](@ToUtc)   AS ToManagua,

        /* ── Ingresos por fuente (estancias cerradas/cobradas, rango por fin/cobro) ── */
        (SELECT COUNT(*) FROM [Service].[RoomStay] AS rs
         WHERE rs.TenantId = @TenantId AND rs.[Status] = 2
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc) AS ClosedStays,

        ISNULL((SELECT SUM(rs.BaseServiceCost + rs.ExtensionCost) FROM [Service].[RoomStay] AS rs
         WHERE rs.TenantId = @TenantId AND rs.[Status] = 2
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc), 0) AS RevenueStays,

        ISNULL((SELECT SUM(c.SubTotal) FROM [Service].[RoomStayConsumption] AS c
         INNER JOIN [Service].[RoomStay] AS rs ON rs.RoomStayId = c.RoomStayId
         WHERE rs.TenantId = @TenantId AND rs.[Status] = 2
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc), 0) AS RevenueProducts,

        ISNULL((SELECT SUM(f.AmountInBase) FROM [Service].[RoomStayFine] AS f
         INNER JOIN [Service].[RoomStay] AS rs ON rs.RoomStayId = f.RoomStayId
         WHERE rs.TenantId = @TenantId AND rs.[Status] = 2 AND f.IsWaived = 0
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
           AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc), 0) AS RevenueFines,

        /* ── Egresos por fuente ── */
        ISNULL((SELECT SUM(m.TotalCost) FROM [Inventory].[InventoryMovement] AS m
         WHERE m.TenantId = @TenantId AND m.MovementType = N'Compra'
           AND m.CreatedOn >= @FromUtc AND m.CreatedOn < @ToUtc), 0) AS ExpensePurchases,

        ISNULL((SELECT SUM(m.TotalCost) FROM [Inventory].[InventoryMovement] AS m
         WHERE m.TenantId = @TenantId AND m.MovementType = N'DevolucionProveedor'
           AND m.CreatedOn >= @FromUtc AND m.CreatedOn < @ToUtc), 0) AS RecoverySupplierReturns,

        ISNULL((SELECT SUM(m.TotalCost) FROM [Inventory].[InventoryMovement] AS m
         WHERE m.TenantId = @TenantId AND m.MovementType = N'DevolucionCliente'
           AND m.CreatedOn >= @FromUtc AND m.CreatedOn < @ToUtc), 0) AS ExpenseCustomerReturns,

        ISNULL((SELECT SUM(p.TotalPaid) FROM [HR].[EmployeePayment] AS p
         WHERE p.TenantId = @TenantId AND p.PaidAtUtc >= @FromUtc AND p.PaidAtUtc < @ToUtc), 0) AS ExpensePayroll,

        ISNULL((SELECT SUM(l.AmountInBase) FROM [Finance].[FinancialLoss] AS l
         WHERE l.TenantId = @TenantId AND l.RecordedAtUtc >= @FromUtc AND l.RecordedAtUtc < @ToUtc), 0) AS ExpenseLosses,

        /* ── Ajustes manuales de caja (restante tras fuentes: no hay doble conteo) ── */
        ISNULL((SELECT SUM(a.AmountInBase) FROM [Finance].[CashBoxAdjustment] AS a
         WHERE a.TenantId = @TenantId AND a.AdjustmentType = 'OUT' AND a.RecordedAt >= @FromUtc AND a.RecordedAt < @ToUtc
           AND (a.SourceCode IS NULL OR a.SourceCode = N'AjusteManual')
           AND a.Reason NOT LIKE N'Pago de empleado%'), 0) AS ExpenseManualAdjustments,

        ISNULL((SELECT SUM(a.AmountInBase) FROM [Finance].[CashBoxAdjustment] AS a
         WHERE a.TenantId = @TenantId AND a.AdjustmentType = 'IN' AND a.RecordedAt >= @FromUtc AND a.RecordedAt < @ToUtc
           AND (a.SourceCode IS NULL OR a.SourceCode = N'AjusteManual')), 0) AS OtherIncomeManualAdjustments
    ;
END
GO
