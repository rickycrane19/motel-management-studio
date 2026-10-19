/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspSetRoomReservationStatus]
   SUBDOMAIN:   Reservation
   DESCRIPTION: Cancela una reservación o la marca como No Show. Solo se permite cerrar
                reservaciones confirmadas (estado 1); una reservación ya cerrada no se
                vuelve a tocar. El Check-In real se registra al abrir la estancia.

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Reservación inexistente)
    50422 -> Unprocessable Entity      (Estado no permitido)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspSetRoomReservationStatus] (
    @TenantId      UNIQUEIDENTIFIER,
    @ReservationId INT,
    @Status        TINYINT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL OR @ReservationId IS NULL OR @ReservationId <= 0
        THROW 50400, N'La reservación no es válida.', 1;

    IF @Status NOT IN (3, 4)
        THROW 50400, N'Solo se puede cancelar la reservación o marcarla como No Show.', 1;

    DECLARE @CurrentStatus TINYINT;

    SELECT @CurrentStatus = res.[Status]
    FROM [Service].[RoomReservation] AS res
    WHERE res.TenantId = @TenantId
      AND res.ReservationId = @ReservationId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'La reservación no existe en este motel.', 1;

    IF @CurrentStatus IN (3, 4)
        THROW 50422, N'La reservación ya está cerrada (cancelada o No Show).', 1;

    IF @CurrentStatus <> 1
        THROW 50422, N'Solo se pueden cerrar reservaciones confirmadas.', 1;

    UPDATE [Service].[RoomReservation]
    SET [Status] = @Status
    WHERE TenantId = @TenantId
      AND ReservationId = @ReservationId;
END
GO
