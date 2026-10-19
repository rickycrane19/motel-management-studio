/* ══════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetPurchases]
   SUBDOMAIN:   Purchase
   DESCRIPTION: Listado PAGINADO de documentos de compra / devolución a proveedor,
                con hora local de Managua. @Search busca por proveedor, referencia,
                notas o número de documento; @PurchaseType y el rango [@FromUtc, @ToUtc)
                filtran el histórico. @TotalRecords (OUTPUT) trae el total de
                coincidencias y @Documents / @BoughtAmount / @ReturnedAmount los
                contadores del rango para las tarjetas de resumen.
   ════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetPurchases] (
    @TenantId       UNIQUEIDENTIFIER,
    @Search         NVARCHAR(150)  = NULL,
    @PurchaseType   NVARCHAR(30)   = NULL,
    @FromUtc        DATETIME2      = NULL,
    @ToUtc          DATETIME2      = NULL,
    @Page           INT            = 1,
    @PageSize       INT            = 20,
    @TotalRecords   INT            = NULL OUTPUT,
    @Documents      INT            = NULL OUTPUT,
    @BoughtAmount   DECIMAL(18,2)  = NULL OUTPUT,
    @ReturnedAmount DECIMAL(18,2)  = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    -- Contadores del rango (independientes del tipo y de la búsqueda).
    SELECT
        @Documents      = COUNT(*),
        @BoughtAmount   = ISNULL(SUM(CASE WHEN p.PurchaseType = 'Compra' THEN p.TotalAmount ELSE 0 END), 0),
        @ReturnedAmount = ISNULL(SUM(CASE WHEN p.PurchaseType = 'DevolucionProveedor' THEN p.TotalAmount ELSE 0 END), 0)
    FROM [Inventory].[Purchase] AS p
    WHERE p.TenantId = @TenantId
      AND (@FromUtc IS NULL OR p.CreatedOn >= @FromUtc)
      AND (@ToUtc IS NULL OR p.CreatedOn < @ToUtc);

    -- Total de coincidencias con los filtros de la tabla.
    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Inventory].[Purchase] AS p
        LEFT JOIN [Inventory].[Supplier] AS s ON s.SupplierId = p.SupplierId
        WHERE p.TenantId = @TenantId
          AND (@PurchaseType IS NULL OR p.PurchaseType = @PurchaseType)
          AND (@FromUtc IS NULL OR p.CreatedOn >= @FromUtc)
          AND (@ToUtc IS NULL OR p.CreatedOn < @ToUtc)
          AND (@Search IS NULL
               OR COALESCE(s.Name, p.SupplierName) LIKE '%' + @Search + '%'
               OR p.ReferenceDoc LIKE '%' + @Search + '%'
               OR p.Notes LIKE '%' + @Search + '%'
               OR CAST(p.PurchaseId AS NVARCHAR(20)) LIKE '%' + @Search + '%')
    );

    SELECT
        p.PurchaseId,
        p.PurchaseType,
        p.SupplierId,
        COALESCE(s.Name, p.SupplierName) AS SupplierName,
        p.ReferenceDoc,
        p.TotalAmount,
        p.CurrencyCode,
        p.CashBoxSessionId,
        p.Notes,
        (SELECT COUNT(*) FROM [Inventory].[PurchaseItem] AS i WHERE i.PurchaseId = p.PurchaseId) AS LineCount,
        p.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](p.CreatedOn) AS CreatedOnManagua
    FROM [Inventory].[Purchase] AS p
    LEFT JOIN [Inventory].[Supplier] AS s ON s.SupplierId = p.SupplierId
    WHERE p.TenantId = @TenantId
      AND (@PurchaseType IS NULL OR p.PurchaseType = @PurchaseType)
      AND (@FromUtc IS NULL OR p.CreatedOn >= @FromUtc)
      AND (@ToUtc IS NULL OR p.CreatedOn < @ToUtc)
      AND (@Search IS NULL
           OR COALESCE(s.Name, p.SupplierName) LIKE '%' + @Search + '%'
           OR p.ReferenceDoc LIKE '%' + @Search + '%'
           OR p.Notes LIKE '%' + @Search + '%'
           OR CAST(p.PurchaseId AS NVARCHAR(20)) LIKE '%' + @Search + '%')
    ORDER BY p.CreatedOn DESC, p.PurchaseId DESC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
