/* ══════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetSupplierById]
   SUBDOMAIN:   Supplier
   DESCRIPTION: Devuelve un proveedor del maestro con sus totales y, en un segundo result set,
                sus últimas compras (para el detalle del listado).
   ══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetSupplierById] (
    @TenantId   UNIQUEIDENTIFIER,
    @SupplierId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        s.SupplierId,
        s.TenantId,
        s.LocationId,
        s.Name,
        s.ContactName,
        s.Phone,
        s.Email,
        s.Address,
        s.TaxId,
        s.Notes,
        s.IsActive,
        s.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](s.CreatedOn) AS CreatedOnManagua,
        (SELECT COUNT(*) FROM [Inventory].[Purchase] AS p WHERE p.SupplierId = s.SupplierId) AS PurchasesCount,
        (SELECT MAX([Configuration].[fnToManaguaTime](p.CreatedOn))
         FROM [Inventory].[Purchase] AS p WHERE p.SupplierId = s.SupplierId) AS LastPurchaseManagua
    FROM [Inventory].[Supplier] AS s
    WHERE s.SupplierId = @SupplierId AND s.TenantId = @TenantId;

    SELECT TOP (5)
        p.PurchaseId,
        p.PurchaseType,
        p.TotalAmount,
        p.CurrencyCode,
        [Configuration].[fnToManaguaTime](p.CreatedOn) AS CreatedOnManagua
    FROM [Inventory].[Purchase] AS p
    WHERE p.SupplierId = @SupplierId AND p.TenantId = @TenantId
    ORDER BY p.CreatedOn DESC, p.PurchaseId DESC;
END
GO
