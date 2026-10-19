/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspUpdateFineType]
   SUBDOMAIN:   FineType
   DESCRIPTION: Actualiza un tipo de multa del catálogo.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Tipo de multa no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspUpdateFineType] (
    @TenantId      UNIQUEIDENTIFIER,
    @FineTypeId    INT,
    @Name          NVARCHAR(120),
    @Description   NVARCHAR(300) = NULL,
    @DefaultAmount DECIMAL(18,4) = 0,
    @IsActive      BIT = 1
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @FineTypeId IS NULL OR @FineTypeId <= 0
        THROW 50400, N'El ID del tipo de multa no es válido.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del tipo de multa es obligatorio.', 1;

    BEGIN TRY
        UPDATE [Service].[FineType]
        SET Name = LTRIM(RTRIM(@Name)),
            Description = @Description,
            DefaultAmount = @DefaultAmount,
            IsActive = @IsActive
        WHERE FineTypeId = @FineTypeId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'El tipo de multa no existe.', 1;
    END TRY
    BEGIN CATCH
        ;THROW;
    END CATCH
END
GO
