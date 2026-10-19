/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetEmployeeDeductions]
   SUBDOMAIN:   EmployeeDeduction
   DESCRIPTION: Listado PAGINADO de las deducciones aplicadas a los empleados (auditoría de
                nómina): tipo, monto y el pago al que pertenecen. Devuelve solo la ventana pedida
                y el total en @TotalRecords (OUTPUT). Filtro opcional por empleado.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetEmployeeDeductions] (
    @TenantId     UNIQUEIDENTIFIER,
    @EmployeeId   INT = NULL,
    @Page         INT = 1,
    @PageSize     INT = 20,
    @TotalRecords INT = NULL OUTPUT
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
        FROM [HR].[EmployeeDeduction] AS d
        WHERE d.TenantId = @TenantId
          AND (@EmployeeId IS NULL OR d.EmployeeId = @EmployeeId)
    );

    SELECT
        d.DeductionId,
        d.TenantId,
        d.EmployeeId,
        e.FullName AS EmployeeName,
        d.PaymentId,
        d.DeductionType,
        CASE d.DeductionType
            WHEN 'INSS' THEN N'INSS'
            WHEN 'IR' THEN N'IR'
            WHEN 'Prestamo' THEN N'Préstamo'
            WHEN 'Adelanto' THEN N'Adelanto'
            WHEN 'Otro' THEN N'Otro'
            ELSE d.DeductionType
        END AS DeductionTypeName,
        d.Description,
        d.Amount,
        d.CurrencyCode,
        d.AmountInBase,
        d.AppliedOn,
        d.Notes,
        d.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](d.CreatedOn) AS CreatedOnManagua,
        d.CreatedBy
    FROM [HR].[EmployeeDeduction] AS d
    INNER JOIN [HR].[Employee] AS e ON e.EmployeeId = d.EmployeeId
    WHERE d.TenantId = @TenantId
      AND (@EmployeeId IS NULL OR d.EmployeeId = @EmployeeId)
    ORDER BY d.AppliedOn DESC, d.DeductionId DESC
    OFFSET ((@Page - 1) * @PageSize) ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
