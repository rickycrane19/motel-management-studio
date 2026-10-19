/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspInsertSupplier]
   SUBDOMAIN:   Supplier
   DESCRIPTION: Registra un nuevo proveedor del maestro para las compras del motel.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos / nombre duplicado)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspInsertSupplier] (
    @TenantId    UNIQUEIDENTIFIER,
    @LocationId  UNIQUEIDENTIFIER = NULL,
    @Name        NVARCHAR(150),
    @ContactName NVARCHAR(150) = NULL,
    @Phone       NVARCHAR(50)  = NULL,
    @Email       NVARCHAR(150) = NULL,
    @Address     NVARCHAR(250) = NULL,
    @TaxId       NVARCHAR(50)  = NULL,
    @Notes       NVARCHAR(500) = NULL,
    @CreatedBy   INT           = NULL,
    @InsertedId  INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del proveedor es obligatorio.', 1;

    IF @Email IS NOT NULL AND LTRIM(RTRIM(@Email)) <> '' AND LTRIM(RTRIM(@Email)) NOT LIKE '%_@_%._%'
        THROW 50400, N'El correo del proveedor no tiene un formato válido.', 1;

    IF EXISTS (
        SELECT 1 FROM [Inventory].[Supplier]
        WHERE TenantId = @TenantId AND Name = LTRIM(RTRIM(@Name))
    )
        THROW 50400, N'Ya tienes un proveedor con ese nombre en tu motel.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Inventory].[Supplier]
        (
            TenantId,
            LocationId,
            Name,
            ContactName,
            Phone,
            Email,
            Address,
            TaxId,
            Notes,
            IsActive,
            CreatedOn,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            LTRIM(RTRIM(@Name)),
            NULLIF(LTRIM(RTRIM(@ContactName)), ''),
            NULLIF(LTRIM(RTRIM(@Phone)), ''),
            NULLIF(LTRIM(RTRIM(@Email)), ''),
            NULLIF(LTRIM(RTRIM(@Address)), ''),
            NULLIF(LTRIM(RTRIM(@TaxId)), ''),
            NULLIF(LTRIM(RTRIM(@Notes)), ''),
            1,
            SYSUTCDATETIME(),
            @CreatedBy
        );

        SET @InsertedId = SCOPE_IDENTITY();

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
