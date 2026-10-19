/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspStartRoomStay]
   SUBDOMAIN:   RoomStay
   DESCRIPTION: Registra el Check-In e inicio de estancia en una habitación:
                llegada a pie o en vehículo (con número de placa), cliente con nombre
                o anónimo (por defecto), servicio de estancia y cálculo de hora de salida.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos, falta de placa si es vehículo)
    50404 -> Not Found                 (Habitación o servicio de estancia no existe)
    50422 -> Conflict/Negocio          (Habitación ocupada, en limpieza o mantenimiento)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspStartRoomStay] (
    @TenantId          UNIQUEIDENTIFIER,
    @LocationId        UNIQUEIDENTIFIER = NULL,
    @RoomId            INT,
    @CustomerName      NVARCHAR(150) = NULL,
    @ArrivalType       TINYINT,             -- 1 = A pie, 2 = En vehículo
    @VehiclePlate      NVARCHAR(30) = NULL, -- Placa o 'A pie'
    @ServiceStayTypeId INT,
    @CashBoxSessionId  INT = NULL,
    @CreatedBy         INT = NULL,
    @Notes             NVARCHAR(500) = NULL,
    @InsertedId        INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomId IS NULL OR @RoomId <= 0
        THROW 50400, N'El ID de la habitación no es válido.', 1;

    IF @ServiceStayTypeId IS NULL OR @ServiceStayTypeId <= 0
        THROW 50400, N'Debes seleccionar un tipo de servicio de estancia válido.', 1;

    IF @ArrivalType NOT IN (1, 2)
        THROW 50400, N'El tipo de llegada debe ser 1 (A pie) o 2 (En vehículo).', 1;

    IF @ArrivalType = 2 AND (NULLIF(LTRIM(RTRIM(@VehiclePlate)), '') IS NULL)
        THROW 50400, N'Para clientes en vehículo, es obligatorio ingresar el número de placa.', 1;

    DECLARE @CurrentStatus TINYINT;
    SELECT @CurrentStatus = [Status]
    FROM [Service].[Room]
    WHERE RoomId = @RoomId AND TenantId = @TenantId AND IsActive = 1;

    IF @CurrentStatus IS NULL
        THROW 50404, N'La habitación seleccionada no existe o no pertenece al motel.', 1;

    IF @CurrentStatus = 1
        THROW 50422, N'La habitación ya se encuentra ocupada por otro servicio.', 1;

    IF @CurrentStatus = 2
        THROW 50422, N'La habitación está en proceso de limpieza. Debe liberarse antes de ocupar.', 1;

    IF @CurrentStatus = 3
        THROW 50422, N'La habitación se encuentra en mantenimiento.', 1;

    DECLARE @DurationHours DECIMAL(5,2);
    DECLARE @Price DECIMAL(18,4);

    SELECT @DurationHours = DurationHours, @Price = Price
    FROM [Service].[ServiceStayType]
    WHERE ServiceStayTypeId = @ServiceStayTypeId AND TenantId = @TenantId AND IsActive = 1;

    IF @DurationHours IS NULL
        THROW 50404, N'El tipo de servicio de estancia no existe o no está activo.', 1;

    DECLARE @EffectiveCustomerName NVARCHAR(150) = ISNULL(NULLIF(LTRIM(RTRIM(@CustomerName)), ''), N'Anónimo');
    DECLARE @CustomerId INT = NULL;

    IF @EffectiveCustomerName <> N'Anónimo'
    BEGIN
        SELECT TOP 1 @CustomerId = CustomerId
        FROM [Service].[Customer]
        WHERE TenantId = @TenantId AND FullName = @EffectiveCustomerName;

        IF @CustomerId IS NULL
        BEGIN
            INSERT INTO [Service].[Customer] (TenantId, FullName, IsAnonymous, CreatedOn)
            VALUES (@TenantId, @EffectiveCustomerName, 0, SYSUTCDATETIME());
            SET @CustomerId = SCOPE_IDENTITY();
        END
    END

    DECLARE @EffectivePlate NVARCHAR(30) = CASE 
        WHEN @ArrivalType = 1 THEN N'A pie' 
        ELSE UPPER(LTRIM(RTRIM(@VehiclePlate))) 
    END;

    DECLARE @StartTimeUtc DATETIME2 = SYSUTCDATETIME();
    DECLARE @ExpectedEndTimeUtc DATETIME2 = DATEADD(MINUTE, CAST(@DurationHours * 60 AS INT), @StartTimeUtc);

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[RoomStay]
        (
            TenantId,
            LocationId,
            RoomId,
            CustomerId,
            CustomerName,
            ArrivalType,
            VehiclePlate,
            ServiceStayTypeId,
            BaseServiceCost,
            StartTimeUtc,
            ExpectedEndTimeUtc,
            [Status],
            ExtendedHours,
            ExtensionCost,
            ProductsTotal,
            TotalAmount,
            PaidAmount,
            IsPaid,
            CashBoxSessionId,
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
            @EffectiveCustomerName,
            @ArrivalType,
            @EffectivePlate,
            @ServiceStayTypeId,
            @Price,
            @StartTimeUtc,
            @ExpectedEndTimeUtc,
            1, -- Activo
            0,
            0,
            0,
            @Price,
            0,
            0,
            @CashBoxSessionId,
            @Notes,
            @CreatedBy,
            @StartTimeUtc
        );

        SET @InsertedId = SCOPE_IDENTITY();

        UPDATE [Service].[Room]
        SET [Status] = 1,
            CurrentRoomStayId = @InsertedId
        WHERE RoomId = @RoomId AND TenantId = @TenantId;

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
