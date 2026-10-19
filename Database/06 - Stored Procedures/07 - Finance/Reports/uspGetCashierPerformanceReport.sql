/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetCashierPerformanceReport]
   SUBDOMAIN:   Reports
   DESCRIPTION: Rendimiento por cajero/usuario en el período [FromUtc, ToUtc): una fila por usuario
                con sesiones de caja en el rango (join [Security].[User]) y, al final, una fila TOTAL.

                  · SessionsCount / OpenSessionsCount / HoursOnShift: sesiones de caja que solapan el
                    rango; las horas se recortan al rango y una sesión abierta usa SYSUTCDATETIME()
                    como fin.
                  · StaysCount / StaysRevenue: estancias cobradas (Status = 2) del rango por
                    COALESCE(ActualEndTimeUtc, CreatedOnUtc). Se atribuyen al dueño de la sesión de
                    caja (RoomStay.CashBoxSessionId ∈ sus sesiones); cuando la estancia NO tiene
                    sesión (CashBoxSessionId IS NULL, datos previos al módulo de caja) se atribuye al
                    usuario que la creó (RoomStay.CreatedBy) para no perder el ingreso.
                  · ProductsRevenue / FinesRevenue: minibar (RoomStayConsumption) y multas no
                    condonadas (RoomStayFine) de esas mismas estancias.
                  · SalesCollected = estancias + productos + multas; AvgTicket = SalesCollected / estancias.
                  · AdjustmentsInBase / AdjustmentsOutBase / TipsInBase / TiesCount: ajustes de caja de
                    sus sesiones registrados en el rango (Tips = IN con SourceCode = 'Propina').
                  · DifferenceBase: suma de DifferenceBase de sus sesiones cerradas del rango.

                ── RESOLUCIÓN DE LA COMISIÓN CON REGLAS MÚLTIPLES ([HR].[CommissionRule]) ───────────────
                El porcentaje de comisión se resuelve por PRIORIDAD DE ALCANCE:
                  1. Regla activa y vigente con ScopeType = 'Employee' para el empleado (join por
                     nombre: [Security].[User].FullName ↔ [HR].[Employee].FullName, como antes).
                  2. Si no, regla activa y vigente con ScopeType = 'Position' que coincida con el
                     puesto de ese empleado.
                  3. Si no, regla activa y vigente con ScopeType = 'All'.
                  4. Si no hay ninguna, cae al valor heredado [HR].[Employee].CommissionRatePercent.
                Dentro del alcance elegido, si hay varios tramos, se usa el TRAMO ALCANZADO: la regla
                con el mayor MinAmount que sea <= al total de SU métrica (Sales → SalesCollected,
                Stays → StaysRevenue, Products → ProductsRevenue, Tips → TipsInBase). El porcentaje se
                aplica sobre el total de esa métrica. Se devuelve CommissionRuleName (nombre de la
                regla aplicada, NULL si fue el valor heredado) y CommissionMetricType (métrica usada).

                La fila TOTAL trae UserId = 0, UserName = 'TOTAL', CommissionRatePercent / RuleName /
                MetricType = NULL; AvgTicket de la fila TOTAL se recalcula sobre el total de estancias.

                Uso: EXEC [Finance].[uspGetCashierPerformanceReport] @TenantId, @FromUtc, @ToUtc, @UserId;
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetCashierPerformanceReport] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2,
    @ToUtc    DATETIME2,
    @UserId   INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CONVERT(DATE, [Configuration].[fnToManaguaTime](SYSUTCDATETIME()));

    /* Sesiones del usuario (o de todos si @UserId es NULL) que solapan [@FromUtc, @ToUtc). */
    ;WITH UserSessions AS (
        SELECT
            s.CashBoxSessionId,
            s.UserId,
            CASE WHEN s.OpenedAtUtc < @FromUtc THEN @FromUtc ELSE s.OpenedAtUtc END AS EffectiveStartUtc,
            CASE WHEN COALESCE(s.ClosedAtUtc, SYSUTCDATETIME()) > @ToUtc THEN @ToUtc
                 ELSE COALESCE(s.ClosedAtUtc, SYSUTCDATETIME()) END AS EffectiveEndUtc,
            s.[Status],
            s.DifferenceBase
        FROM [Finance].[CashBoxSession] AS s
        WHERE s.TenantId = @TenantId
          AND s.OpenedAtUtc < @ToUtc
          AND COALESCE(s.ClosedAtUtc, SYSUTCDATETIME()) > @FromUtc
          AND (@UserId IS NULL OR s.UserId = @UserId)
    ),
    SessionAgg AS (
        SELECT
            us.UserId,
            COUNT(*) AS SessionsCount,
            SUM(CASE WHEN us.[Status] = 1 THEN 1 ELSE 0 END) AS OpenSessionsCount,
            CAST(SUM(DATEDIFF(MINUTE, us.EffectiveStartUtc, us.EffectiveEndUtc)) AS DECIMAL(18,4)) / 60.0 AS HoursOnShift,
            SUM(CASE WHEN us.[Status] = 2 THEN us.DifferenceBase ELSE 0 END) AS DifferenceBase
        FROM UserSessions AS us
        GROUP BY us.UserId
    ),
    UsersInReport AS (
        SELECT u.UserId, u.Username, u.FullName, u.Role
        FROM [Security].[User] AS u
        WHERE u.TenantId = @TenantId
          AND EXISTS (SELECT 1 FROM UserSessions AS us WHERE us.UserId = u.UserId)
          AND (@UserId IS NULL OR u.UserId = @UserId)
    ),
    /* Estancias cobradas del rango atribuidas a cada usuario del reporte. */
    MatchedStays AS (
        SELECT DISTINCT rs.RoomStayId, u.UserId
        FROM [Service].[RoomStay] AS rs
        INNER JOIN UsersInReport AS u
            ON (rs.CashBoxSessionId IS NOT NULL
                AND EXISTS (SELECT 1 FROM UserSessions AS us
                            WHERE us.UserId = u.UserId AND us.CashBoxSessionId = rs.CashBoxSessionId))
            OR (rs.CashBoxSessionId IS NULL AND rs.CreatedBy = u.UserId)
        WHERE rs.TenantId = @TenantId
          AND rs.[Status] = 2
          AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
          AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc
    ),
    StaysAgg AS (
        SELECT
            ms.UserId,
            COUNT(*) AS StaysCount,
            ISNULL(SUM(rs.BaseServiceCost + rs.ExtensionCost), 0) AS StaysRevenue
        FROM MatchedStays AS ms
        INNER JOIN [Service].[RoomStay] AS rs ON rs.RoomStayId = ms.RoomStayId
        GROUP BY ms.UserId
    ),
    ProductsAgg AS (
        SELECT ms.UserId, ISNULL(SUM(c.SubTotal), 0) AS ProductsRevenue
        FROM MatchedStays AS ms
        INNER JOIN [Service].[RoomStayConsumption] AS c ON c.RoomStayId = ms.RoomStayId
        GROUP BY ms.UserId
    ),
    FinesAgg AS (
        SELECT ms.UserId, ISNULL(SUM(f.AmountInBase), 0) AS FinesRevenue
        FROM MatchedStays AS ms
        INNER JOIN [Service].[RoomStayFine] AS f ON f.RoomStayId = ms.RoomStayId AND f.IsWaived = 0
        GROUP BY ms.UserId
    ),
    AdjustmentsAgg AS (
        SELECT
            us.UserId,
            ISNULL(SUM(CASE WHEN a.AdjustmentType = 'IN' THEN a.AmountInBase ELSE 0 END), 0) AS AdjustmentsInBase,
            ISNULL(SUM(CASE WHEN a.AdjustmentType = 'OUT' THEN a.AmountInBase ELSE 0 END), 0) AS AdjustmentsOutBase,
            ISNULL(SUM(CASE WHEN a.AdjustmentType = 'IN' AND a.SourceCode = N'Propina' THEN a.AmountInBase ELSE 0 END), 0) AS TipsInBase,
            ISNULL(SUM(CASE WHEN a.AdjustmentType = 'IN' AND a.SourceCode = N'Propina' THEN 1 ELSE 0 END), 0) AS TiesCount
        FROM [Finance].[CashBoxAdjustment] AS a
        INNER JOIN UserSessions AS us ON us.CashBoxSessionId = a.CashBoxSessionId
        WHERE a.TenantId = @TenantId
          AND a.RecordedAt >= @FromUtc AND a.RecordedAt < @ToUtc
        GROUP BY us.UserId
    ),
    PerUser AS (
        SELECT
            u.UserId,
            u.Username AS UserName,
            u.FullName AS UserFullName,
            u.Role AS Role,
            ISNULL(sa.SessionsCount, 0) AS SessionsCount,
            ISNULL(sa.OpenSessionsCount, 0) AS OpenSessionsCount,
            ISNULL(sa.HoursOnShift, 0) AS HoursOnShift,
            ISNULL(st.StaysCount, 0) AS StaysCount,
            ISNULL(st.StaysRevenue, 0) AS StaysRevenue,
            ISNULL(pr.ProductsRevenue, 0) AS ProductsRevenue,
            ISNULL(fi.FinesRevenue, 0) AS FinesRevenue,
            ISNULL(st.StaysRevenue, 0) + ISNULL(pr.ProductsRevenue, 0) + ISNULL(fi.FinesRevenue, 0) AS SalesCollected,
            ISNULL(adj.AdjustmentsInBase, 0) AS AdjustmentsInBase,
            ISNULL(adj.AdjustmentsOutBase, 0) AS AdjustmentsOutBase,
            ISNULL(adj.TipsInBase, 0) AS TipsInBase,
            ISNULL(adj.TiesCount, 0) AS TiesCount,
            ISNULL(sa.DifferenceBase, 0) AS DifferenceBase,
            emp.EmployeeId AS EmployeeId,
            emp.EmployeePosition AS EmployeePosition,
            ISNULL(emp.CommissionRatePercent, 0) AS LegacyRatePercent,
            [Configuration].[fnToManaguaTime](@FromUtc) AS FromManagua,
            [Configuration].[fnToManaguaTime](@ToUtc) AS ToManagua
        FROM UsersInReport AS u
        LEFT JOIN SessionAgg AS sa ON sa.UserId = u.UserId
        LEFT JOIN StaysAgg AS st ON st.UserId = u.UserId
        LEFT JOIN ProductsAgg AS pr ON pr.UserId = u.UserId
        LEFT JOIN FinesAgg AS fi ON fi.UserId = u.UserId
        LEFT JOIN AdjustmentsAgg AS adj ON adj.UserId = u.UserId
        OUTER APPLY (
            SELECT TOP (1)
                e.EmployeeId,
                e.Position AS EmployeePosition,
                e.CommissionRatePercent
            FROM [HR].[Employee] AS e
            WHERE e.TenantId = @TenantId AND e.FullName = u.FullName
            ORDER BY e.CommissionRatePercent DESC, e.EmployeeId
        ) AS emp
    ),
    /* Resolución de la regla de comisión por prioridad de alcance y tramo alcanzado. */
    Resolved AS (
        SELECT
            p.*,
            cr.RuleName AS CommissionRuleName,
            COALESCE(cr.MetricType, N'Sales') AS CommissionMetricType,
            COALESCE(cr.RatePercent, p.LegacyRatePercent) AS CommissionRatePercent,
            COALESCE(cr.MetricTotal, p.SalesCollected) AS CommissionBase
        FROM PerUser AS p
        OUTER APPLY (
            SELECT TOP (1)
                r.[Name] AS RuleName,
                r.MetricType,
                r.RatePercent,
                CASE r.MetricType
                    WHEN 'Stays'    THEN p.StaysRevenue
                    WHEN 'Products' THEN p.ProductsRevenue
                    WHEN 'Tips'     THEN p.TipsInBase
                    ELSE p.SalesCollected
                END AS MetricTotal
            FROM [HR].[CommissionRule] AS r
            WHERE r.TenantId = @TenantId
              AND r.IsActive = 1
              AND r.StartDate <= @Today
              AND (r.EndDate IS NULL OR r.EndDate >= @Today)
              AND (
                    (r.ScopeType = 'Employee' AND p.EmployeeId IS NOT NULL AND r.EmployeeId = p.EmployeeId)
                 OR (r.ScopeType = 'Position' AND p.EmployeePosition IS NOT NULL AND r.Position = p.EmployeePosition)
                 OR (r.ScopeType = 'All')
              )
            ORDER BY
                /* 1.º prioridad de alcance: Employee > Position > All */
                CASE r.ScopeType WHEN 'Employee' THEN 1 WHEN 'Position' THEN 2 ELSE 3 END,
                /* 2.º el tramo alcanzado primero (MinAmount <= total de su métrica) */
                CASE WHEN r.MinAmount <= (CASE r.MetricType
                        WHEN 'Stays' THEN p.StaysRevenue
                        WHEN 'Products' THEN p.ProductsRevenue
                        WHEN 'Tips' THEN p.TipsInBase
                        ELSE p.SalesCollected END) THEN 0 ELSE 1 END,
                /* 3.º el mayor MinAmount alcanzado; si ninguno alcanza, el tramo de entrada */
                CASE WHEN r.MinAmount <= (CASE r.MetricType
                        WHEN 'Stays' THEN p.StaysRevenue
                        WHEN 'Products' THEN p.ProductsRevenue
                        WHEN 'Tips' THEN p.TipsInBase
                        ELSE p.SalesCollected END)
                     THEN r.MinAmount END DESC,
                r.MinAmount ASC,
                r.RuleId DESC
        ) AS cr
    ),
    Computed AS (
        SELECT
            *,
            CAST(CASE WHEN StaysCount = 0 THEN 0 ELSE SalesCollected / StaysCount END AS DECIMAL(18,4)) AS AvgTicket,
            CAST(CommissionBase * CommissionRatePercent / 100.0 AS DECIMAL(18,4)) AS CommissionAmount
        FROM Resolved
    )
    SELECT * FROM (
    SELECT
        UserId,
        UserName,
        UserFullName,
        Role,
        SessionsCount,
        OpenSessionsCount,
        CAST(HoursOnShift AS DECIMAL(18,2)) AS HoursOnShift,
        StaysCount,
        CAST(StaysRevenue AS DECIMAL(18,4)) AS StaysRevenue,
        CAST(ProductsRevenue AS DECIMAL(18,4)) AS ProductsRevenue,
        CAST(FinesRevenue AS DECIMAL(18,4)) AS FinesRevenue,
        CAST(SalesCollected AS DECIMAL(18,4)) AS SalesCollected,
        AvgTicket,
        CAST(AdjustmentsInBase AS DECIMAL(18,4)) AS AdjustmentsInBase,
        CAST(AdjustmentsOutBase AS DECIMAL(18,4)) AS AdjustmentsOutBase,
        CAST(TipsInBase AS DECIMAL(18,4)) AS TipsInBase,
        TiesCount,
        CAST(CommissionRuleName AS NVARCHAR(120)) AS CommissionRuleName,
        CAST(CommissionMetricType AS NVARCHAR(20)) AS CommissionMetricType,
        CAST(CommissionRatePercent AS DECIMAL(5,2)) AS CommissionRatePercent,
        CommissionAmount,
        CAST(DifferenceBase AS DECIMAL(18,4)) AS DifferenceBase,
        FromManagua,
        ToManagua
    FROM Computed
    UNION ALL
    SELECT
        0, N'TOTAL', N'TOTAL', NULL,
        SUM(SessionsCount), SUM(OpenSessionsCount), CAST(SUM(HoursOnShift) AS DECIMAL(18,2)),
        SUM(StaysCount), SUM(StaysRevenue), SUM(ProductsRevenue), SUM(FinesRevenue), SUM(SalesCollected),
        CAST(CASE WHEN SUM(StaysCount) = 0 THEN 0 ELSE SUM(SalesCollected) / SUM(StaysCount) END AS DECIMAL(18,4)),
        SUM(AdjustmentsInBase), SUM(AdjustmentsOutBase), SUM(TipsInBase), SUM(TiesCount),
        CAST(NULL AS NVARCHAR(120)),
        CAST(NULL AS NVARCHAR(20)),
        NULL,
        CAST(SUM(CommissionAmount) AS DECIMAL(18,4)),
        SUM(DifferenceBase),
        MAX(FromManagua), MAX(ToManagua)
    FROM Computed
    ) AS Report
    ORDER BY CASE WHEN UserId = 0 THEN 1 ELSE 0 END, SalesCollected DESC, UserName;
END
GO
