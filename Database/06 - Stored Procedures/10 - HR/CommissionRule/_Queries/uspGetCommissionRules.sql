/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetCommissionRules]
   SUBDOMAIN:   CommissionRule
   DESCRIPTION: Listado paginado de reglas de comisión con el alcance resuelto (empleado o puesto)
                y la métrica/tramo/vigencia de cada una. Devuelve SOLO la página pedida y, en
                @TotalRecords (OUTPUT), el total de coincidencias para paginar en la UI.

                Filtros: @Search (nombre, empleado o puesto), @OnlyActive, @ScopeType, @MetricType.
                @RuleId permite traer una sola regla (pantalla de edición).

                Orden determinista: activas primero, luego por alcance, métrica, tramo y RuleId.

   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetCommissionRules] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @OnlyActive   BIT           = NULL,
    @ScopeType    NVARCHAR(20)  = NULL,
    @MetricType   NVARCHAR(20)  = NULL,
    @RuleId       INT           = NULL,
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
    SET @ScopeType = NULLIF(LTRIM(RTRIM(@ScopeType)), '');
    SET @MetricType = NULLIF(LTRIM(RTRIM(@MetricType)), '');

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [HR].[CommissionRule] AS r
        LEFT JOIN [HR].[Employee] AS e ON e.EmployeeId = r.EmployeeId
        WHERE r.TenantId = @TenantId
          AND (@RuleId IS NULL OR r.RuleId = @RuleId)
          AND (@OnlyActive IS NULL OR r.IsActive = @OnlyActive)
          AND (@ScopeType IS NULL OR r.ScopeType = @ScopeType)
          AND (@MetricType IS NULL OR r.MetricType = @MetricType)
          AND (@Search IS NULL
               OR r.Name LIKE '%' + @Search + '%'
               OR e.FullName LIKE '%' + @Search + '%'
               OR r.Position LIKE '%' + @Search + '%')
    );

    SELECT
        r.RuleId,
        r.TenantId,
        r.[Name],
        r.ScopeType,
        CASE r.ScopeType
            WHEN 'Employee' THEN N'Empleado'
            WHEN 'Position' THEN N'Puesto'
            ELSE N'General'
        END AS ScopeTypeName,
        r.EmployeeId,
        e.FullName      AS EmployeeName,
        e.Position      AS EmployeePosition,
        r.Position,
        CASE r.ScopeType
            WHEN 'Employee' THEN e.FullName
            WHEN 'Position' THEN r.Position
            ELSE N'Todos los empleados'
        END AS TargetLabel,
        r.MetricType,
        CASE r.MetricType
            WHEN 'Sales'    THEN N'Ventas'
            WHEN 'Stays'    THEN N'Estancias'
            WHEN 'Products' THEN N'Minibar'
            WHEN 'Tips'     THEN N'Propinas'
            ELSE r.MetricType
        END AS MetricTypeName,
        r.MinAmount,
        r.MaxAmount,
        r.RatePercent,
        r.StartDate,
        r.EndDate,
        r.IsActive,
        r.Notes,
        r.CreatedOn,
        r.CreatedBy
    FROM [HR].[CommissionRule] AS r
    LEFT JOIN [HR].[Employee] AS e ON e.EmployeeId = r.EmployeeId
    WHERE r.TenantId = @TenantId
      AND (@RuleId IS NULL OR r.RuleId = @RuleId)
      AND (@OnlyActive IS NULL OR r.IsActive = @OnlyActive)
      AND (@ScopeType IS NULL OR r.ScopeType = @ScopeType)
      AND (@MetricType IS NULL OR r.MetricType = @MetricType)
      AND (@Search IS NULL
           OR r.Name LIKE '%' + @Search + '%'
           OR e.FullName LIKE '%' + @Search + '%'
           OR r.Position LIKE '%' + @Search + '%')
    ORDER BY r.IsActive DESC, r.ScopeType, r.MetricType, r.MinAmount, r.RuleId DESC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
