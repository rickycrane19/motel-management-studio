/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetPayrollExpenseReport]
   SUBDOMAIN:   Reports
   DESCRIPTION: Nómina consolidada en el período [FromUtc, ToUtc) por empleado, con BRUTO
                (base + bono), deducciones DESGLOSADAS por tipo (INSS, IR, Préstamo, Adelanto,
                Otro), bono, NETO pagado y cuántos turnos extra hubo. Al final devuelve una
                fila TOTAL (EmployeeId = 0) con la misma información sumada del período.
                Un pago marcado como turno extra (IsExtraShift = 1) se cuenta como extra; el
                resto es pago ordinario del contrato.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetPayrollExpenseReport] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2,
    @ToUtc    DATETIME2
)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH pay AS
    (
        SELECT
            p.PaymentId,
            p.EmployeeId,
            p.BaseAmount,
            p.BonusAmount,
            p.DeductionsAmount,
            p.TotalPaid,
            p.IsExtraShift,
            p.PaidAtUtc
        FROM [HR].[EmployeePayment] AS p
        WHERE p.TenantId = @TenantId
          AND p.PaidAtUtc >= @FromUtc
          AND p.PaidAtUtc < @ToUtc
    ),
    det AS
    (
        SELECT
            d.PaymentId,
            SUM(CASE WHEN d.DeductionType = 'INSS'     THEN d.Amount ELSE 0 END) AS Inss,
            SUM(CASE WHEN d.DeductionType = 'IR'       THEN d.Amount ELSE 0 END) AS Ir,
            SUM(CASE WHEN d.DeductionType = 'Prestamo' THEN d.Amount ELSE 0 END) AS Prestamo,
            SUM(CASE WHEN d.DeductionType = 'Adelanto' THEN d.Amount ELSE 0 END) AS Adelanto,
            SUM(CASE WHEN d.DeductionType = 'Otro'     THEN d.Amount ELSE 0 END) AS Otro,
            SUM(d.Amount) AS TotalDet
        FROM [HR].[EmployeeDeduction] AS d
        WHERE d.TenantId = @TenantId
        GROUP BY d.PaymentId
    ),
    combined AS
    (
        SELECT
            pay.EmployeeId,
            pay.BaseAmount,
            pay.BonusAmount,
            pay.DeductionsAmount,
            pay.TotalPaid,
            pay.IsExtraShift,
            pay.PaidAtUtc,
            ISNULL(det.Inss, 0)     AS Inss,
            ISNULL(det.Ir, 0)       AS Ir,
            ISNULL(det.Prestamo, 0) AS Prestamo,
            ISNULL(det.Adelanto, 0) AS Adelanto,
            /* Lo que no tenga detalle (pagos históricos) se agrupa en «Otro» para que el
               desglose siempre cuadre con el total de deducciones del pago. */
            ISNULL(det.Otro, 0)
                + CASE WHEN ISNULL(det.TotalDet, 0) < pay.DeductionsAmount
                            THEN pay.DeductionsAmount - ISNULL(det.TotalDet, 0)
                       ELSE 0 END AS Otro
        FROM pay
        LEFT JOIN det ON det.PaymentId = pay.PaymentId
    ),
    contractTypes AS
    (
        SELECT EmployeeId, PaymentType AS ContractPaymentType
        FROM
        (
            SELECT ec.EmployeeId, ec.PaymentType,
                   ROW_NUMBER() OVER (PARTITION BY ec.EmployeeId ORDER BY ec.ContractId DESC) AS rn
            FROM [HR].[EmployeeContract] AS ec
            WHERE ec.TenantId = @TenantId
        ) AS ranked
        WHERE ranked.rn = 1
    )
    SELECT
        ISNULL(e.EmployeeId, 0) AS EmployeeId,
        CASE WHEN GROUPING(e.EmployeeId) = 1 THEN N'TOTAL' ELSE e.FullName END AS FullName,
        CASE WHEN GROUPING(e.EmployeeId) = 1 THEN N'' ELSE e.Position END AS Position,
        CASE WHEN GROUPING(e.EmployeeId) = 1 THEN NULL ELSE c.ContractPaymentType END AS ContractPaymentType,
        COUNT(*) AS PaymentsCount,
        SUM(combined.BaseAmount + combined.BonusAmount) AS GrossPaid,
        SUM(combined.BonusAmount) AS BonusAmount,
        SUM(combined.DeductionsAmount) AS DeductionsAmount,
        SUM(combined.Inss)     AS InssDeductions,
        SUM(combined.Ir)       AS IrDeductions,
        SUM(combined.Prestamo) AS LoanDeductions,
        SUM(combined.Adelanto) AS AdvanceDeductions,
        SUM(combined.Otro)     AS OtherDeductions,
        SUM(combined.TotalPaid) AS NetPaid,
        SUM(combined.TotalPaid) AS TotalPaid,
        SUM(CASE WHEN combined.IsExtraShift = 0 THEN combined.TotalPaid ELSE 0 END) AS ContractPaid,
        SUM(CASE WHEN combined.IsExtraShift = 1 THEN combined.TotalPaid ELSE 0 END) AS ExtraPaid,
        COUNT(CASE WHEN combined.IsExtraShift = 1 THEN 1 END) AS ExtraPayments,
        SUM(CASE WHEN combined.IsExtraShift = 1 THEN 1 ELSE 0 END) AS ExtraShifts,
        MAX(combined.PaidAtUtc) AS LastPaidAtUtc
    FROM combined
    INNER JOIN [HR].[Employee] AS e ON e.EmployeeId = combined.EmployeeId
    LEFT JOIN contractTypes AS c ON c.EmployeeId = combined.EmployeeId
    GROUP BY GROUPING SETS
    (
        (e.EmployeeId, e.FullName, e.Position, c.ContractPaymentType),
        ()
    )
    ORDER BY CASE WHEN GROUPING(e.EmployeeId) = 1 THEN 1 ELSE 0 END, SUM(combined.TotalPaid) DESC;
END
GO
