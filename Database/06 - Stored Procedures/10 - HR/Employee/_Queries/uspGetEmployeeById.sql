/* ══════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetEmployeeById]
   SUBDOMAIN:   Employee
   DESCRIPTION: Ficha completa de un empleado (mismo shape que el listado paginado), con el
                contrato vigente del día si lo tiene. Devuelve una sola fila (o vacío).
   ══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetEmployeeById] (
    @TenantId   UNIQUEIDENTIFIER,
    @EmployeeId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CONVERT(DATE, [Configuration].[fnToManaguaTime](SYSUTCDATETIME()));

    SELECT
        e.EmployeeId,
        e.TenantId,
        e.LocationId,
        e.FullName,
        e.Position,
        e.PaymentType,
        CASE e.PaymentType
            WHEN 'Hourly' THEN N'Por Hora'
            WHEN 'Daily' THEN N'Por Día'
            WHEN 'PerShift' THEN N'Por Turno'
            WHEN 'Weekly' THEN N'Semanal'
            WHEN 'Monthly' THEN N'Mensual'
            ELSE e.PaymentType
        END AS PaymentTypeName,
        e.Rate,
        e.CurrencyCode,
        e.CommissionRatePercent,
        e.Phone,
        e.IsActive,
        e.CreatedOn,
        CASE WHEN c.ContractId IS NULL THEN 0 ELSE 1 END AS HasActiveContract,
        c.ContractId,
        c.ContractPaymentType,
        c.ContractBaseAmount
    FROM [HR].[Employee] AS e
    OUTER APPLY
    (
        SELECT TOP 1 ec.ContractId, ec.PaymentType AS ContractPaymentType, ec.BaseAmount AS ContractBaseAmount
        FROM [HR].[EmployeeContract] AS ec
        WHERE ec.EmployeeId = e.EmployeeId
          AND ec.TenantId = e.TenantId
          AND ec.IsActive = 1
          AND ec.StartDate <= @Today
          AND (ec.EndDate IS NULL OR @Today <= ec.EndDate)
        ORDER BY ec.StartDate DESC, ec.ContractId DESC
    ) AS c
    WHERE e.TenantId = @TenantId
      AND e.EmployeeId = @EmployeeId;
END
GO
