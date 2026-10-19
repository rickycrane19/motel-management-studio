/* ══════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetEmployees]
   SUBDOMAIN:   Employee
   DESCRIPTION: Listado PAGINADO del personal del motel: puesto, modalidad y tarifa, más el
                contrato vigente del día (si lo tiene). Devuelve SOLO la página pedida y, en
                @TotalRecords (OUTPUT), el total de coincidencias para paginar en la UI.
                Filtros: búsqueda por nombre/puesto/teléfono y estado (activo/inactivo/todos).
   ══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetEmployees] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @PaymentType  NVARCHAR(20)  = NULL,
    @OnlyActive   BIT           = NULL,
    @Page         INT           = 1,
    @PageSize     INT           = 20,
    @TotalRecords INT           = NULL OUTPUT
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

    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');
    SET @PaymentType = NULLIF(LTRIM(RTRIM(@PaymentType)), '');

    DECLARE @Today DATE = CONVERT(DATE, [Configuration].[fnToManaguaTime](SYSUTCDATETIME()));

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [HR].[Employee] AS e
        WHERE e.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR e.IsActive = @OnlyActive)
          AND (@PaymentType IS NULL OR e.PaymentType = @PaymentType)
          AND (@Search IS NULL
               OR e.FullName LIKE '%' + @Search + '%'
               OR e.Position LIKE '%' + @Search + '%'
               OR e.Phone LIKE '%' + @Search + '%')
    );

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
      AND (@OnlyActive IS NULL OR e.IsActive = @OnlyActive)
      AND (@PaymentType IS NULL OR e.PaymentType = @PaymentType)
      AND (@Search IS NULL
           OR e.FullName LIKE '%' + @Search + '%'
           OR e.Position LIKE '%' + @Search + '%'
           OR e.Phone LIKE '%' + @Search + '%')
    ORDER BY e.FullName
    OFFSET ((@Page - 1) * @PageSize) ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
