/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetEmployeeContracts]
   SUBDOMAIN:   EmployeeContract
   DESCRIPTION: Listado PAGINADO de contratos laborales con el empleado, la modalidad y el salario.
                @EmployeeId -> histórico de un solo empleado; @Active -> NULL = todos,
                1 = activos, 0 = terminados. @Search busca por empleado, puesto o notas;
                @PaymentType filtra la modalidad y @Status el estado de vigencia
                (all | active | expiring | expired | ended; días calculados en hora de Managua).
                @TotalRecords (OUTPUT) trae el total y @ActiveCount / @ExpiringCount /
                @ExpiredCount / @EndedCount los contadores para las tarjetas de resumen.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetEmployeeContracts] (
    @TenantId        UNIQUEIDENTIFIER,
    @EmployeeId      INT           = NULL,
    @Active          BIT           = NULL,
    @Search          NVARCHAR(150) = NULL,
    @PaymentType     NVARCHAR(30)  = NULL,
    @Status          NVARCHAR(20)  = NULL,
    @Page            INT           = 1,
    @PageSize        INT           = 20,
    @TotalRecords    INT           = NULL OUTPUT,
    @ActiveCount     INT           = NULL OUTPUT,
    @ExpiringCount   INT           = NULL OUTPUT,
    @ExpiredCount    INT           = NULL OUTPUT,
    @EndedCount      INT           = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    DECLARE @Today DATE = CONVERT(DATE, [Configuration].[fnToManaguaTime](SYSUTCDATETIME()));

    -- Contadores del tenant (independientes de los filtros de la tabla).
    SELECT
        @ActiveCount   = ISNULL(SUM(CASE WHEN c.IsActive = 1 AND (c.EndDate IS NULL OR c.EndDate >= @Today) THEN 1 ELSE 0 END), 0),
        @ExpiredCount  = ISNULL(SUM(CASE WHEN c.IsActive = 1 AND c.EndDate IS NOT NULL AND c.EndDate < @Today THEN 1 ELSE 0 END), 0),
        @ExpiringCount = ISNULL(SUM(CASE WHEN c.IsActive = 1 AND c.EndDate IS NOT NULL AND c.EndDate >= @Today AND c.EndDate <= DATEADD(DAY, 30, @Today) THEN 1 ELSE 0 END), 0),
        @EndedCount    = ISNULL(SUM(CASE WHEN c.IsActive = 0 THEN 1 ELSE 0 END), 0)
    FROM [HR].[EmployeeContract] AS c
    WHERE c.TenantId = @TenantId;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [HR].[EmployeeContract] AS c
        INNER JOIN [HR].[Employee] AS e ON c.EmployeeId = e.EmployeeId
        WHERE c.TenantId = @TenantId
          AND (@EmployeeId IS NULL OR c.EmployeeId = @EmployeeId)
          AND (@Active IS NULL OR c.IsActive = @Active)
          AND (@PaymentType IS NULL OR c.PaymentType = @PaymentType)
          AND (@Search IS NULL
               OR e.FullName LIKE '%' + @Search + '%'
               OR c.Position LIKE '%' + @Search + '%'
               OR c.ScheduleNotes LIKE '%' + @Search + '%')
          AND (@Status IS NULL
               OR @Status = 'all'
               OR (@Status = 'active'   AND c.IsActive = 1 AND (c.EndDate IS NULL OR c.EndDate >= @Today))
               OR (@Status = 'expiring' AND c.IsActive = 1 AND c.EndDate IS NOT NULL AND c.EndDate >= @Today AND c.EndDate <= DATEADD(DAY, 30, @Today))
               OR (@Status = 'expired'  AND c.IsActive = 1 AND c.EndDate IS NOT NULL AND c.EndDate < @Today)
               OR (@Status = 'ended'    AND c.IsActive = 0))
    );

    SELECT
        c.ContractId,
        c.TenantId,
        c.EmployeeId,
        e.FullName      AS EmployeeName,
        e.Position      AS EmployeePosition,
        c.Position,
        c.PaymentType,
        CASE c.PaymentType
            WHEN 'Hourly' THEN N'Por Hora'
            WHEN 'Daily' THEN N'Por Día'
            WHEN 'PerShift' THEN N'Por Turno'
            WHEN 'Weekly' THEN N'Semanal'
            WHEN 'Monthly' THEN N'Mensual'
            ELSE c.PaymentType
        END AS PaymentTypeName,
        c.BaseAmount,
        c.CurrencyCode,
        c.StartDate,
        c.EndDate,
        c.IsActive,
        CASE
            WHEN c.EndDate IS NOT NULL THEN DATEDIFF(DAY, @Today, c.EndDate)
            ELSE NULL
        END AS DaysToEnd,
        c.ScheduleNotes,
        c.Notes,
        c.CreatedOn,
        c.CreatedBy
    FROM [HR].[EmployeeContract] AS c
    INNER JOIN [HR].[Employee] AS e ON c.EmployeeId = e.EmployeeId
    WHERE c.TenantId = @TenantId
      AND (@EmployeeId IS NULL OR c.EmployeeId = @EmployeeId)
      AND (@Active IS NULL OR c.IsActive = @Active)
      AND (@PaymentType IS NULL OR c.PaymentType = @PaymentType)
      AND (@Search IS NULL
           OR e.FullName LIKE '%' + @Search + '%'
           OR c.Position LIKE '%' + @Search + '%'
           OR c.ScheduleNotes LIKE '%' + @Search + '%')
      AND (@Status IS NULL
           OR @Status = 'all'
           OR (@Status = 'active'   AND c.IsActive = 1 AND (c.EndDate IS NULL OR c.EndDate >= @Today))
           OR (@Status = 'expiring' AND c.IsActive = 1 AND c.EndDate IS NOT NULL AND c.EndDate >= @Today AND c.EndDate <= DATEADD(DAY, 30, @Today))
           OR (@Status = 'expired'  AND c.IsActive = 1 AND c.EndDate IS NOT NULL AND c.EndDate < @Today)
           OR (@Status = 'ended'    AND c.IsActive = 0))
    ORDER BY c.StartDate DESC, c.ContractId DESC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
