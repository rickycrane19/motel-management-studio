/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspInsertProduct]
   SUBDOMAIN:   Product
   DESCRIPTION: Registra un nuevo producto para minibar o tienda del motel.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Categoría no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspInsertProduct] (
    @TenantId      UNIQUEIDENTIFIER,
    @LocationId    UNIQUEIDENTIFIER = NULL,
    @CategoryId    INT,
    @Code          NVARCHAR(50),
    @Name          NVARCHAR(150),
    @Description   NVARCHAR(500) = NULL,
    @CostPrice     DECIMAL(18,4),
    @SalePrice     DECIMAL(18,4),
    @CurrentStock  DECIMAL(12,2) = 0,
    @MinStock      DECIMAL(12,2) = 5,
    @UnitOfMeasure NVARCHAR(20) = 'UND',
    @ImageUrl      NVARCHAR(500) = NULL,
    @CreatedBy     INT = NULL,
    @InsertedId    INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del producto es obligatorio.', 1;

    IF @CategoryId IS NULL OR @CategoryId <= 0
        THROW 50400, N'Debes seleccionar una categoría válida.', 1;

    IF @SalePrice < 0 OR @CostPrice < 0
        THROW 50400, N'Los precios de costo y venta no pueden ser negativos.', 1;

    IF NOT EXISTS (SELECT 1 FROM [Inventory].[Category] WHERE CategoryId = @CategoryId AND TenantId = @TenantId AND IsActive = 1)
        THROW 50404, N'La categoría seleccionada no existe o está inactiva.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Inventory].[Product]
        (
            TenantId,
            LocationId,
            CategoryId,
            Code,
            Name,
            Description,
            CostPrice,
            SalePrice,
            CurrentStock,
            MinStock,
            UnitOfMeasure,
            ImageUrl,
            IsActive,
            CreatedOn,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @CategoryId,
            LTRIM(RTRIM(@Code)),
            LTRIM(RTRIM(@Name)),
            @Description,
            @CostPrice,
            @SalePrice,
            @CurrentStock,
            @MinStock,
            @UnitOfMeasure,
            @ImageUrl,
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
