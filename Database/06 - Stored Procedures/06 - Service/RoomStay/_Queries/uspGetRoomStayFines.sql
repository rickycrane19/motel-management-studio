/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetRoomStayFines]
   SUBDOMAIN:   RoomStayFine
   DESCRIPTION: Listado PAGINADO de multas registradas en una estancia con su estado de
                condonación. Mantiene el filtro por @RoomStayId y devuelve SOLO la página pedida
                y, en @TotalRecords (OUTPUT), el total de multas de esa estancia.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetRoomStayFines] (
    @TenantId     UNIQUEIDENTIFIER,
    @RoomStayId   INT,
    @Page         INT = 1,
    @PageSize     INT = 20,
    @TotalRecords INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Service].[RoomStayFine] AS f
        WHERE f.RoomStayId = @RoomStayId AND f.TenantId = @TenantId
    );

    SELECT
        f.FineId,
        f.RoomStayId,
        f.FineTypeId,
        ft.Name AS FineTypeName,
        f.Description,
        f.Amount,
        f.CurrencyCode,
        f.AmountInBase,
        f.ExchangeRate,
        f.IsWaived,
        f.WaivedReason,
        f.WaivedAtUtc,
        [Configuration].[fnToManaguaTime](f.WaivedAtUtc) AS WaivedAtManagua,
        f.RecordedBy,
        f.RecordedAtUtc,
        [Configuration].[fnToManaguaTime](f.RecordedAtUtc) AS RecordedAtManagua
    FROM [Service].[RoomStayFine] AS f
    LEFT JOIN [Service].[FineType] AS ft ON f.FineTypeId = ft.FineTypeId
    WHERE f.RoomStayId = @RoomStayId AND f.TenantId = @TenantId
    ORDER BY f.RecordedAtUtc, f.FineId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
