/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetFinancialLosses]
   SUBDOMAIN:   FinancialLoss
   DESCRIPTION: Listado paginado DESC de pérdidas registradas, con cálculo de hora local Managua
                y filtros opcionales de rango y categoría. Devuelve SOLO la página pedida y, en
                @TotalRecords (OUTPUT), el total de coincidencias para poder paginar en la UI.
                Solo lectura: la pérdida es un registro inmutable (no hay edición ni borrado).
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetFinancialLosses] (
    @TenantId     UNIQUEIDENTIFIER,
    @FromUtc      DATETIME2 = NULL,
    @ToUtc        DATETIME2 = NULL,
    @CategoryCode NVARCHAR(30) = NULL,
    @Page         INT = 1,
    @PageSize     INT = 50,
    @TotalRecords INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1
        SET @Page = 1;

    IF @PageSize IS NULL OR @PageSize < 1
        SET @PageSize = 50;

    IF @PageSize > 200
        SET @PageSize = 200;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Finance].[FinancialLoss] AS l
        WHERE l.TenantId = @TenantId
          AND (@FromUtc IS NULL OR l.RecordedAtUtc >= @FromUtc)
          AND (@ToUtc IS NULL OR l.RecordedAtUtc < @ToUtc)
          AND (@CategoryCode IS NULL OR l.CategoryCode = @CategoryCode)
    );

    SELECT
        l.LossId,
        l.TenantId,
        l.LocationId,
        l.CategoryCode,
        CASE l.CategoryCode
            WHEN 'Habitacion' THEN N'Habitación'
            WHEN 'Minibar'    THEN N'Minibar'
            WHEN 'Caja'       THEN N'Caja'
            ELSE N'Otro'
        END AS CategoryName,
        l.RoomId,
        r.RoomNumber,
        l.RoomStayId,
        l.[Description],
        l.Amount,
        l.CurrencyCode,
        l.ExchangeRate,
        l.AmountInBase,
        l.CashBoxSessionId,
        [Configuration].[fnToManaguaTime](l.RecordedAtUtc) AS RecordedAtManagua,
        u.FullName AS CreatedByName
    FROM [Finance].[FinancialLoss] AS l
    LEFT JOIN [Service].[Room] AS r ON r.RoomId = l.RoomId
    LEFT JOIN [Security].[User] AS u ON u.UserId = l.CreatedBy
    WHERE l.TenantId = @TenantId
      AND (@FromUtc IS NULL OR l.RecordedAtUtc >= @FromUtc)
      AND (@ToUtc IS NULL OR l.RecordedAtUtc < @ToUtc)
      AND (@CategoryCode IS NULL OR l.CategoryCode = @CategoryCode)
    ORDER BY l.RecordedAtUtc DESC, l.LossId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO
