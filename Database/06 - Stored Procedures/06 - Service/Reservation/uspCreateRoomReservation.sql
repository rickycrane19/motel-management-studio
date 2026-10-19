/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspCreateRoomReservation]
   SUBDOMAIN:   Reservation
   DESCRIPTION: Crea una reservación de habitación validando que no haya colisión horaria
                con otra reservación activa en el intervalo UTC.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50422 -> Conflict/Negocio          (Horario en el pasado o ya reservado)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspCreateRoomReservation] (
    @TenantId            UNIQUEIDENTIFIER,
    @LocationId          UNIQUEIDENTIFIER = NULL,
    @RoomId              INT,
    @CustomerId          INT = NULL,
    @CustomerName        NVARCHAR(150),
    @Phone               NVARCHAR(50) = NULL,
    @ServiceStayTypeId   INT,
    @ReservationStartUtc DATETIME2,
    @ReservationEndUtc   DATETIME2,
    @DepositAmount       DECIMAL(18,4) = 0,
    @Notes               NVARCHAR(500) = NULL,
    @CreatedBy           INT = NULL,
    @InsertedId          INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomId IS NULL OR @RoomId <= 0
        THROW 50400, N'El ID de la habitación no es válido.', 1;

    IF NULLIF(LTRIM(RTRIM(@CustomerName)), '') IS NULL
        THROW 50400, N'El nombre del cliente para la reservación es obligatorio.', 1;

    IF @CustomerId IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM [Service].[Customer] AS c
        WHERE c.TenantId = @TenantId
          AND c.CustomerId = @CustomerId
          AND c.IsAnonymous = 0)
        THROW 50400, N'El cliente seleccionado no existe en este motel.', 1;

    IF @ReservationEndUtc <= @ReservationStartUtc
        THROW 50400, N'La fecha/hora de fin de la reserva debe ser posterior a la de inicio.', 1;

    IF @ReservationStartUtc < SYSUTCDATETIME()
        THROW 50422, N'No se pueden registrar reservaciones en fechas u horas pasadas.', 1;

    IF EXISTS (
        SELECT 1
        FROM [Service].[RoomReservation]
        WHERE RoomId = @RoomId
          AND TenantId = @TenantId
          AND [Status] = 1 -- Confirmada
          AND (@ReservationStartUtc < ReservationEndUtc AND @ReservationEndUtc > ReservationStartUtc)
    )
    BEGIN
        THROW 50422, N'La habitación ya tiene una reservación confirmada en ese intervalo de horario.', 1;
    END

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[RoomReservation]
        (
            TenantId,
            LocationId,
            RoomId,
            CustomerId,
            CustomerName,
            Phone,
            ServiceStayTypeId,
            ReservationStartUtc,
            ReservationEndUtc,
            DepositAmount,
            [Status],
            Notes,
            CreatedBy,
            CreatedOnUtc
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @RoomId,
            @CustomerId,
            LTRIM(RTRIM(@CustomerName)),
            @Phone,
            @ServiceStayTypeId,
            @ReservationStartUtc,
            @ReservationEndUtc,
            @DepositAmount,
            1, -- Confirmada
            @Notes,
            @CreatedBy,
            SYSUTCDATETIME()
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
