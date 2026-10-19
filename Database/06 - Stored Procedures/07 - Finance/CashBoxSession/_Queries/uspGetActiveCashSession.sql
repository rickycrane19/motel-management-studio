/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetActiveCashSession]
   SUBDOMAIN:   CashBoxSession
   DESCRIPTION: Obtiene la sesión de caja abierta actualmente para el cajero o caja,
                con sus totales acumulados en vivo (apertura, ventas, entradas, salidas y calculado).
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetActiveCashSession] (
    @TenantId  UNIQUEIDENTIFIER,
    @UserId    INT = NULL,
    @CashBoxId INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        s.CashBoxSessionId,
        s.TenantId,
        s.LocationId,
        s.CashBoxId,
        cb.Name AS CashBoxName,
        s.UserId,
        u.FullName AS UserName,
        s.ShiftName,
        s.OpenedAtUtc,
        [Configuration].[fnToManaguaTime](s.OpenedAtUtc) AS OpenedAtManagua,
        s.[Status] AS StatusCode,
        s.OpeningBalanceBase,
        s.TotalSalesBase,
        s.TotalInAdjustmentsBase,
        s.TotalOutAdjustmentsBase,
        (s.OpeningBalanceBase + s.TotalSalesBase + s.TotalInAdjustmentsBase - s.TotalOutAdjustmentsBase) AS CurrentCalculatedBase,
        s.Notes
    FROM [Finance].[CashBoxSession] AS s
    INNER JOIN [Finance].[CashBox] AS cb ON s.CashBoxId = cb.CashBoxId
    INNER JOIN [Security].[User] AS u ON s.UserId = u.UserId
    WHERE s.TenantId = @TenantId
      AND s.[Status] = 1 -- Abierta
      AND (@UserId IS NULL OR s.UserId = @UserId)
      AND (@CashBoxId IS NULL OR s.CashBoxId = @CashBoxId)
    ORDER BY s.OpenedAtUtc DESC;
END
GO
