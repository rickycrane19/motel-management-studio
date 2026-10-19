/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetProducts]
   SUBDOMAIN:   Product
   DESCRIPTION: Lista paginada de los productos y stock de minibar del motel con alerta de
                stock bajo. Devuelve SOLO la página pedida y, en @TotalRecords (OUTPUT), el
                total de coincidencias para paginar en la UI (RT-05: el servidor pagina).

                Filtros:
                  @Search     -> nombre, código (SKU) o categoría (LIKE %texto%)
                  @OnlyActive -> NULL = todos; 1 = solo activos; 0 = solo ocultos/inactivos
                  @CategoryId -> restringe a una categoría
                  @ProductId  -> lee un solo producto por su Id (ficha / edición)

                Orden determinista: Name, ProductId.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetProducts] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150)  = NULL,
    @OnlyActive   BIT            = NULL,
    @CategoryId   INT            = NULL,
    @ProductId    INT            = NULL,
    @Page         INT            = 1,
    @PageSize     INT            = 20,
    @TotalRecords INT            = NULL OUTPUT
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
        FROM [Inventory].[Product] AS p
        INNER JOIN [Inventory].[Category] AS c ON p.CategoryId = c.CategoryId
        WHERE p.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR p.IsActive = @OnlyActive)
          AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
          AND (@ProductId IS NULL OR p.ProductId = @ProductId)
          AND (@Search IS NULL
               OR p.Name LIKE '%' + @Search + '%'
               OR p.Code LIKE '%' + @Search + '%'
               OR c.Name LIKE '%' + @Search + '%')
    );

    SELECT
        p.ProductId,
        p.TenantId,
        p.LocationId,
        p.CategoryId,
        c.Name AS CategoryName,
        p.Code,
        p.Name,
        p.Description,
        p.CostPrice,
        p.SalePrice,
        p.CurrentStock,
        p.MinStock,
        p.UnitOfMeasure,
        p.ImageUrl,
        p.IsActive,
        CASE WHEN p.CurrentStock <= p.MinStock THEN 1 ELSE 0 END AS IsLowStock
    FROM [Inventory].[Product] AS p
    INNER JOIN [Inventory].[Category] AS c ON p.CategoryId = c.CategoryId
    WHERE p.TenantId = @TenantId
      AND (@OnlyActive IS NULL OR p.IsActive = @OnlyActive)
      AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
      AND (@ProductId IS NULL OR p.ProductId = @ProductId)
      AND (@Search IS NULL
           OR p.Name LIKE '%' + @Search + '%'
           OR p.Code LIKE '%' + @Search + '%'
           OR c.Name LIKE '%' + @Search + '%')
    ORDER BY p.Name, p.ProductId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
