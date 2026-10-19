/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspSetRoomActive]
   SUBDOMAIN:   Room
   DESCRIPTION: Desactiva o reactiva una habitación sin borrarla. Al desactivarla deja de
                aparecer en el monitor de habitaciones y en el POS.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Habitación no existe)
    50422 -> Conflict/Negocio          (La habitación tiene una estancia activa)
   ══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspSetRoomActive] (
    @TenantId  UNIQUEIDENTIFIER,
    @RoomId    INT,
    @IsActive  BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomId IS NULL OR @RoomId <= 0
        THROW 50400, N'El RoomId es obligatorio.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado de la habitación.', 1;

    IF @IsActive = 0
    BEGIN
        IF EXISTS (SELECT 1 FROM [Service].[RoomStay] WHERE RoomId = @RoomId AND [Status] = 1)
            THROW 50422, N'La habitación tiene una estancia activa: cobra y finaliza la estancia antes de desactivarla.', 1;

        IF EXISTS (SELECT 1 FROM [Service].[RoomReservation] WHERE RoomId = @RoomId AND [Status] IN (1, 2))
            THROW 50422, N'La habitación tiene reservas confirmadas: cáncelalas antes de desactivarla.', 1;
    END

    UPDATE [Service].[Room]
    SET IsActive = @IsActive
    WHERE RoomId = @RoomId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'La habitación indicada no existe.', 1;
END
GO
