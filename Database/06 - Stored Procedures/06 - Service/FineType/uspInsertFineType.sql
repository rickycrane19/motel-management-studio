/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspInsertFineType]
   SUBDOMAIN:   FineType
   DESCRIPTION: Inserta un tipo de multa del catálogo (daño a lencería, faltante, etc.).

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspInsertFineType] (
    @TenantId      UNIQUEIDENTIFIER,
    @Name          NVARCHAR(120),
    @Description   NVARCHAR(300) = NULL,
    @DefaultAmount DECIMAL(18,4) = 0,
    @InsertedId    INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del tipo de multa es obligatorio.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[FineType] (TenantId, Name, Description, DefaultAmount, IsActive, CreatedOn)
        VALUES (@TenantId, LTRIM(RTRIM(@Name)), @Description, @DefaultAmount, 1, SYSUTCDATETIME());

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
