/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspInsertEmployeeContract]
   SUBDOMAIN:   EmployeeContract
   DESCRIPTION: Registra el contrato laboral de un empleado (mensual, diario, por turno, etc.).
                El puesto y la modalidad se congelan en el contrato; sirve de base para la
                nómina mensual y para sugerir la tarifa de los turnos extra pagados por día.

   ──────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Empleado no existe)
    50422 -> Conflict/Negocio          (El contrato se solapa con otro vigente del empleado)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspInsertEmployeeContract] (
    @TenantId       UNIQUEIDENTIFIER,
    @EmployeeId     INT,
    @Position       NVARCHAR(100),
    @PaymentType    NVARCHAR(20),     -- 'Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly'
    @BaseAmount     DECIMAL(18,4),
    @CurrencyCode   CHAR(3) = 'NIO',
    @StartDate      DATE,
    @EndDate        DATE = NULL,
    @ScheduleNotes  NVARCHAR(300) = NULL,
    @Notes          NVARCHAR(500) = NULL,
    @CreatedBy      INT = NULL,
    @InsertedId     INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @EmployeeId IS NULL OR @EmployeeId <= 0
        THROW 50400, N'El EmployeeId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Position)), '') IS NULL
        THROW 50400, N'El puesto del contrato es obligatorio.', 1;

    IF @PaymentType NOT IN ('Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly')
        THROW 50400, N'La modalidad de pago no es válida. Debe ser Hourly, Daily, PerShift, Weekly o Monthly.', 1;

    IF @BaseAmount < 0
        THROW 50400, N'El monto base del contrato no puede ser negativo.', 1;

    IF @StartDate IS NULL
        THROW 50400, N'La fecha de inicio del contrato es obligatoria.', 1;

    IF @EndDate IS NOT NULL AND @EndDate < @StartDate
        THROW 50400, N'La fecha de fin no puede ser anterior a la fecha de inicio.', 1;

    IF NOT EXISTS (SELECT 1 FROM [HR].[Employee] WHERE EmployeeId = @EmployeeId AND TenantId = @TenantId AND IsActive = 1)
        THROW 50404, N'El empleado no existe o está inactivo.', 1;

    -- Guardarraíl de solapamiento: el contrato nace vigente, no puede pisar otro vigente del mismo empleado.
    IF EXISTS
    (
        SELECT 1
        FROM [HR].[EmployeeContract] AS ec
        WHERE ec.TenantId = @TenantId
          AND ec.EmployeeId = @EmployeeId
          AND ec.IsActive = 1
          AND ec.StartDate <= COALESCE(@EndDate, '9999-12-31')
          AND @StartDate <= COALESCE(ec.EndDate, '9999-12-31')
    )
        THROW 50422, N'Ese rango se solapa con otro contrato vigente del empleado. Termina o ajusta el contrato existente antes de registrar el nuevo.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [HR].[EmployeeContract]
        (
            TenantId,
            EmployeeId,
            Position,
            PaymentType,
            BaseAmount,
            CurrencyCode,
            StartDate,
            EndDate,
            IsActive,
            ScheduleNotes,
            Notes,
            CreatedOn,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @EmployeeId,
            LTRIM(RTRIM(@Position)),
            @PaymentType,
            @BaseAmount,
            @CurrencyCode,
            @StartDate,
            @EndDate,
            1,
            NULLIF(@ScheduleNotes, ''),
            NULLIF(@Notes, ''),
            SYSUTCDATETIME(),
            @CreatedBy
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
