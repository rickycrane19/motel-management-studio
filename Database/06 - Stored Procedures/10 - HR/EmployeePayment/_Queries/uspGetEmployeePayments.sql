/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetEmployeePayments]
   SUBDOMAIN:   EmployeePayment
   DESCRIPTION: Historial PAGINADO de pagos de nómina de los empleados. Devuelve solo la ventana
                pedida y, en @TotalRecords (OUTPUT), el total de coincidencias para paginar.
                Incluye si el pago fue un turno extra, su contrato, cuántas deducciones tiene y
                el neto pagado. Filtros: empleado y rango de período (por solape).
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetEmployeePayments] (
    @TenantId     UNIQUEIDENTIFIER,
    @EmployeeId   INT  = NULL,
    @FromDate     DATE = NULL,
    @ToDate       DATE = NULL,
    @Page         INT  = 1,
    @PageSize     INT  = 20,
    @TotalRecords INT  = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1
        SET @Page = 1;

    IF @PageSize IS NULL OR @PageSize < 1
        SET @PageSize = 20;

    IF @PageSize > 200
        SET @PageSize = 200;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [HR].[EmployeePayment] AS p
        WHERE p.TenantId = @TenantId
          AND (@EmployeeId IS NULL OR p.EmployeeId = @EmployeeId)
          AND (@FromDate IS NULL OR p.PeriodEnd >= @FromDate)
          AND (@ToDate IS NULL OR p.PeriodStart <= @ToDate)
    );

    SELECT
        p.PaymentId,
        p.EmployeeId,
        e.FullName AS EmployeeName,
        e.Position,
        p.PaymentType,
        p.PeriodStart,
        p.PeriodEnd,
        p.UnitsWorked,
        p.RateApplied,
        p.BaseAmount,
        p.BonusAmount,
        p.DeductionsAmount,
        p.TotalPaid,
        p.TotalPaid AS NetPaid,
        p.CurrencyCode,
        p.PaidFromCashBoxSessionId,
        p.IsExtraShift,
        p.ContractId,
        CASE WHEN p.ContractId IS NULL THEN 0 ELSE 1 END AS HasContract,
        (SELECT COUNT(*) FROM [HR].[EmployeeDeduction] AS d WHERE d.PaymentId = p.PaymentId) AS DeductionsCount,
        p.Notes,
        p.PaidAtUtc,
        [Configuration].[fnToManaguaTime](p.PaidAtUtc) AS PaidAtManagua
    FROM [HR].[EmployeePayment] AS p
    INNER JOIN [HR].[Employee] AS e ON p.EmployeeId = e.EmployeeId
    WHERE p.TenantId = @TenantId
      AND (@EmployeeId IS NULL OR p.EmployeeId = @EmployeeId)
      AND (@FromDate IS NULL OR p.PeriodEnd >= @FromDate)
      AND (@ToDate IS NULL OR p.PeriodStart <= @ToDate)
    ORDER BY p.PaidAtUtc DESC, p.PaymentId DESC
    OFFSET ((@Page - 1) * @PageSize) ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
