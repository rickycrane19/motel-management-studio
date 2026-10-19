/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspSetFineTypeActive]
   SUBDOMAIN:   FineType
   DESCRIPTION: Activa o desactiva un tipo de multa sin borrarlo; los registros históricos
                de multas aplicadas conservan su referencia.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Tipo de multa no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspSetFineTypeActive] (
    @TenantId   UNIQUEIDENTIFIER,
    @FineTypeId INT,
    @IsActive   BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @FineTypeId IS NULL OR @FineTypeId <= 0
        THROW 50400, N'El ID del tipo de multa no es válido.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado del tipo de multa.', 1;

    UPDATE [Service].[FineType]
    SET IsActive = @IsActive
    WHERE FineTypeId = @FineTypeId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El tipo de multa indicado no existe.', 1;
END
GO
