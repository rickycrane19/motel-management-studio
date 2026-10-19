/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetCategories]
   SUBDOMAIN:   Category
   DESCRIPTION: Lista paginada de las categorías de inventario del tenant. Devuelve SOLO la
                página pedida y, en @TotalRecords (OUTPUT), el total de coincidencias para
                paginar en la UI (RT-05: el servidor pagina).

                Filtros:
                  @Search     -> nombre o descripción (LIKE %texto%)
                  @OnlyActive -> NULL = todas; 1 = solo activas; 0 = solo inactivas

                Orden determinista: Name, CategoryId.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetCategories] (
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

    SET @Page = CASE WHEN @Page IS NULL OR @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize IS NULL OR @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Inventory].[Category] AS c
        WHERE c.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR c.IsActive = @OnlyActive)
          AND (@Search IS NULL
               OR c.Name LIKE '%' + @Search + '%'
               OR c.Description LIKE '%' + @Search + '%')
    );

    SELECT
        c.CategoryId,
        c.Name,
        c.Description,
        c.IsActive
    FROM [Inventory].[Category] AS c
    WHERE c.TenantId = @TenantId
      AND (@OnlyActive IS NULL OR c.IsActive = @OnlyActive)
      AND (@Search IS NULL
           OR c.Name LIKE '%' + @Search + '%'
           OR c.Description LIKE '%' + @Search + '%')
    ORDER BY c.Name, c.CategoryId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
