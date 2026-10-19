/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspUpdateServiceStayType]
   SUBDOMAIN:   ServiceStayType
   DESCRIPTION: Actualiza un tipo de servicio de estancia (tarifa por tiempo) del catálogo.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Tipo de servicio de estancia no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspUpdateServiceStayType] (
    @TenantId          UNIQUEIDENTIFIER,
    @ServiceStayTypeId INT,
    @RoomTypeId        INT = NULL,
    @Name              NVARCHAR(100),
    @DurationHours     DECIMAL(5,2),
    @Price             DECIMAL(18,4),
    @IsExtension       BIT = 0,
    @IsActive          BIT = 1
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ServiceStayTypeId IS NULL OR @ServiceStayTypeId <= 0
        THROW 50400, N'El ID del tipo de servicio de estancia no es válido.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del servicio de estancia es obligatorio.', 1;

    IF @DurationHours IS NULL OR @DurationHours <= 0
        THROW 50400, N'La duración en horas debe ser mayor a 0.', 1;

    IF @Price IS NULL OR @Price < 0
        THROW 50400, N'El precio no puede ser negativo.', 1;

    BEGIN TRY
        UPDATE [Service].[ServiceStayType]
        SET RoomTypeId    = @RoomTypeId,
            Name          = LTRIM(RTRIM(@Name)),
            DurationHours = @DurationHours,
            Price         = @Price,
            IsExtension   = @IsExtension,
            IsActive      = @IsActive
        WHERE ServiceStayTypeId = @ServiceStayTypeId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'El tipo de servicio de estancia no existe.', 1;
    END TRY
    BEGIN CATCH
        ;THROW;
    END CATCH
END
GO
