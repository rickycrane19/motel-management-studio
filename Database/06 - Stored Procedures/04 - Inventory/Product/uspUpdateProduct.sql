/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspUpdateProduct]
   SUBDOMAIN:   Product
   DESCRIPTION: Actualiza los datos de un producto de minibar existente.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Producto no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspUpdateProduct] (
    @TenantId      UNIQUEIDENTIFIER,
    @ProductId     INT,
    @CategoryId    INT,
    @Code          NVARCHAR(50),
    @Name          NVARCHAR(150),
    @Description   NVARCHAR(500) = NULL,
    @CostPrice     DECIMAL(18,4),
    @SalePrice     DECIMAL(18,4),
    @MinStock      DECIMAL(12,2) = 5,
    @UnitOfMeasure NVARCHAR(20) = 'UND',
    @ImageUrl      NVARCHAR(500) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ProductId IS NULL OR @ProductId <= 0
        THROW 50400, N'El ProductId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del producto es obligatorio.', 1;

    IF @CategoryId IS NULL OR @CategoryId <= 0
        THROW 50400, N'Debes seleccionar una categoría válida.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Inventory].[Product]
        SET CategoryId = @CategoryId,
            Code = LTRIM(RTRIM(@Code)),
            Name = LTRIM(RTRIM(@Name)),
            Description = @Description,
            CostPrice = @CostPrice,
            SalePrice = @SalePrice,
            MinStock = @MinStock,
            UnitOfMeasure = @UnitOfMeasure,
            ImageUrl = @ImageUrl
        WHERE ProductId = @ProductId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'El producto indicado no existe.', 1;

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
