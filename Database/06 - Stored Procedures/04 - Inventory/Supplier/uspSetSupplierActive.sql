/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspSetSupplierActive]
   SUBDOMAIN:   Supplier
   DESCRIPTION: Oculta o vuelve a mostrar un proveedor del maestro sin borrarlo.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Proveedor no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspSetSupplierActive] (
    @TenantId   UNIQUEIDENTIFIER,
    @SupplierId INT,
    @IsActive   BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @SupplierId IS NULL OR @SupplierId <= 0
        THROW 50400, N'El SupplierId es obligatorio.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado del proveedor.', 1;

    UPDATE [Inventory].[Supplier]
    SET IsActive = @IsActive
    WHERE SupplierId = @SupplierId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El proveedor indicado no existe.', 1;
END
GO
