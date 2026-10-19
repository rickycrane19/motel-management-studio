/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspSetServiceStayTypeActive]
   SUBDOMAIN:   ServiceStayType
   DESCRIPTION: Activa o desactiva una tarifa de estancia sin borrarla; la desactivada deja de
                ofrecerse en recepción, pero se conserva en el histórico de estancias.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Tarifa no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspSetServiceStayTypeActive] (
    @TenantId          UNIQUEIDENTIFIER,
    @ServiceStayTypeId INT,
    @IsActive          BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ServiceStayTypeId IS NULL OR @ServiceStayTypeId <= 0
        THROW 50400, N'El ID del tipo de servicio de estancia no es válido.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado del tipo de servicio de estancia.', 1;

    UPDATE [Service].[ServiceStayType]
    SET IsActive = @IsActive
    WHERE ServiceStayTypeId = @ServiceStayTypeId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El tipo de servicio de estancia indicado no existe.', 1;
END
GO
