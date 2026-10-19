/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspSetProductActive]
   SUBDOMAIN:   Product
   DESCRIPTION: Oculta o vuelve a mostrar un producto del minibar sin borrarlo.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Producto no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspSetProductActive] (
    @TenantId  UNIQUEIDENTIFIER,
    @ProductId INT,
    @IsActive  BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ProductId IS NULL OR @ProductId <= 0
        THROW 50400, N'El ProductId es obligatorio.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado del producto.', 1;

    UPDATE [Inventory].[Product]
    SET IsActive = @IsActive
    WHERE ProductId = @ProductId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El producto indicado no existe.', 1;
END
GO
