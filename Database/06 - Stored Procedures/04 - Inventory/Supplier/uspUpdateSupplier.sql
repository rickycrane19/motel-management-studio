/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspUpdateSupplier]
   SUBDOMAIN:   Supplier
   DESCRIPTION: Actualiza los datos de contacto de un proveedor del maestro.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos / nombre duplicado)
    50404 -> Not Found                 (Proveedor no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspUpdateSupplier] (
    @TenantId    UNIQUEIDENTIFIER,
    @SupplierId  INT,
    @Name        NVARCHAR(150),
    @ContactName NVARCHAR(150) = NULL,
    @Phone       NVARCHAR(50)  = NULL,
    @Email       NVARCHAR(150) = NULL,
    @Address     NVARCHAR(250) = NULL,
    @TaxId       NVARCHAR(50)  = NULL,
    @Notes       NVARCHAR(500) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @SupplierId IS NULL OR @SupplierId <= 0
        THROW 50400, N'El SupplierId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del proveedor es obligatorio.', 1;

    IF @Email IS NOT NULL AND LTRIM(RTRIM(@Email)) <> '' AND LTRIM(RTRIM(@Email)) NOT LIKE '%_@_%._%'
        THROW 50400, N'El correo del proveedor no tiene un formato válido.', 1;

    IF EXISTS (
        SELECT 1 FROM [Inventory].[Supplier]
        WHERE TenantId = @TenantId AND Name = LTRIM(RTRIM(@Name)) AND SupplierId <> @SupplierId
    )
        THROW 50400, N'Ya tienes un proveedor con ese nombre en tu motel.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Inventory].[Supplier]
        SET Name = LTRIM(RTRIM(@Name)),
            ContactName = NULLIF(LTRIM(RTRIM(@ContactName)), ''),
            Phone = NULLIF(LTRIM(RTRIM(@Phone)), ''),
            Email = NULLIF(LTRIM(RTRIM(@Email)), ''),
            Address = NULLIF(LTRIM(RTRIM(@Address)), ''),
            TaxId = NULLIF(LTRIM(RTRIM(@TaxId)), ''),
            Notes = NULLIF(LTRIM(RTRIM(@Notes)), '')
        WHERE SupplierId = @SupplierId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'El proveedor indicado no existe.', 1;

        IF @IsTranStarted = 1
            COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() = -1
            ROLLBACK TRAN;
        ELSE IF XACT_STATE() = 1 AND @IsTranStarted = 1
            ROLLBACK TRAN;

        ;THROW;
    END CATCH
END
GO
