/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetRoomTypes]
   SUBDOMAIN:   RoomType
   DESCRIPTION: Listado PAGINADO de tipos de cuarto del motel. Devuelve SOLO la página pedida
                y, en @TotalRecords (OUTPUT), el total de coincidencias para paginar en la UI.
                @Search busca por nombre o descripción; @OnlyActive (NULL = ambos) filtra por
                estado. Los comboboxes siguen funcionando con @OnlyActive = 1 y @PageSize = 200.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetRoomTypes] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @OnlyActive   BIT           = NULL,
    @Page         INT           = 1,
    @PageSize     INT           = 20,
    @TotalRecords INT           = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Service].[RoomType] AS rt
        WHERE rt.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR rt.IsActive = @OnlyActive)
          AND (@Search IS NULL
               OR rt.Name LIKE '%' + @Search + '%'
               OR rt.Description LIKE '%' + @Search + '%')
    );

    SELECT
        rt.RoomTypeId,
        rt.Name,
        rt.Description,
        rt.BasePrice,
        rt.HasGarage,
        rt.HasJacuzzi,
        rt.Capacity,
        rt.IsActive
    FROM [Service].[RoomType] AS rt
    WHERE rt.TenantId = @TenantId
      AND (@OnlyActive IS NULL OR rt.IsActive = @OnlyActive)
      AND (@Search IS NULL
           OR rt.Name LIKE '%' + @Search + '%'
           OR rt.Description LIKE '%' + @Search + '%')
    ORDER BY rt.BasePrice, rt.RoomTypeId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
