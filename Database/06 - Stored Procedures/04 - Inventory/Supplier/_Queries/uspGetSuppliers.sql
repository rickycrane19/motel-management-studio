/* ══════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetSuppliers]
   SUBDOMAIN:   Supplier
   DESCRIPTION: Listado paginado del maestro de proveedores, con búsqueda por nombre, contacto,
                teléfono o RUC y filtro de estado. Devuelve SOLO la página pedida y, en
                @TotalRecords (OUTPUT), el total de coincidencias para paginar en la UI.
                @TotalCount / @ActiveCount / @WithPurchasesCount alimentan las tarjetas de
                resumen del maestro. Incluye el número de compras asociadas y la última compra.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetSuppliers] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @OnlyActive   BIT           = NULL,
    @Page         INT           = 1,
    @PageSize     INT           = 50,
    @TotalRecords INT           = NULL OUTPUT,
    @TotalCount   INT           = NULL OUTPUT,
    @ActiveCount  INT           = NULL OUTPUT,
    @WithPurchasesCount INT    = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1
        SET @Page = 1;

    IF @PageSize IS NULL OR @PageSize < 1
        SET @PageSize = 50;

    IF @PageSize > 500
        SET @PageSize = 500;

    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Inventory].[Supplier] AS s
        WHERE s.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR s.IsActive = @OnlyActive)
          AND (@Search IS NULL
               OR s.Name LIKE '%' + @Search + '%'
               OR s.ContactName LIKE '%' + @Search + '%'
               OR s.Phone LIKE '%' + @Search + '%'
               OR s.TaxId LIKE '%' + @Search + '%')
    );

    -- Contadores del maestro (independientes de la búsqueda y del filtro de estado).
    SELECT
        @TotalCount          = COUNT(*),
        @ActiveCount         = ISNULL(SUM(CASE WHEN s.IsActive = 1 THEN 1 ELSE 0 END), 0),
        @WithPurchasesCount  = ISNULL(SUM(CASE WHEN x.PurchasesCount > 0 THEN 1 ELSE 0 END), 0)
    FROM [Inventory].[Supplier] AS s
    OUTER APPLY (
        SELECT COUNT(*) AS PurchasesCount
        FROM [Inventory].[Purchase] AS p
        WHERE p.SupplierId = s.SupplierId
    ) AS x
    WHERE s.TenantId = @TenantId;

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
    WHERE s.TenantId = @TenantId
      AND (@OnlyActive IS NULL OR s.IsActive = @OnlyActive)
      AND (@Search IS NULL
           OR s.Name LIKE '%' + @Search + '%'
           OR s.ContactName LIKE '%' + @Search + '%'
           OR s.Phone LIKE '%' + @Search + '%'
           OR s.TaxId LIKE '%' + @Search + '%')
    ORDER BY s.Name
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
