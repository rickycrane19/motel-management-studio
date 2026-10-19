/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspUpdateEmployeeContract]
   SUBDOMAIN:   EmployeeContract
   DESCRIPTION: Actualiza las condiciones de un contrato laboral (puesto, modalidad, monto base,
                vigencia y horario). Los pagos ya registrados no cambian.

   ──────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Contrato no existe)
    50422 -> Conflict/Negocio          (El contrato se solapa con otro vigente del empleado)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspUpdateEmployeeContract] (
    @TenantId       UNIQUEIDENTIFIER,
    @ContractId     INT,
    @Position       NVARCHAR(100),
    @PaymentType    NVARCHAR(20),     -- 'Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly'
    @BaseAmount     DECIMAL(18,4),
    @CurrencyCode   CHAR(3) = 'NIO',
    @StartDate      DATE,
    @EndDate        DATE = NULL,
    @ScheduleNotes  NVARCHAR(300) = NULL,
    @Notes          NVARCHAR(500) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ContractId IS NULL OR @ContractId <= 0
        THROW 50400, N'El ContractId es obligatorio.', 1;

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

    -- Guardarraíl de solapamiento: si el contrato queda vigente, no puede pisar otro vigente del empleado.
    DECLARE @EmployeeId INT;
    DECLARE @CurrentIsActive BIT;
    SELECT @EmployeeId = EmployeeId, @CurrentIsActive = IsActive
    FROM [HR].[EmployeeContract]
    WHERE ContractId = @ContractId AND TenantId = @TenantId;

    IF @CurrentIsActive IS NULL
        THROW 50404, N'El contrato indicado no existe.', 1;

    IF @CurrentIsActive = 1
       AND EXISTS
       (
           SELECT 1
           FROM [HR].[EmployeeContract] AS ec
           WHERE ec.TenantId = @TenantId
             AND ec.EmployeeId = @EmployeeId
             AND ec.IsActive = 1
             AND ec.ContractId <> @ContractId
             AND ec.StartDate <= COALESCE(@EndDate, '9999-12-31')
             AND @StartDate <= COALESCE(ec.EndDate, '9999-12-31')
       )
        THROW 50422, N'Ese rango se solapa con otro contrato vigente del empleado. Termina o ajusta el contrato existente antes de guardar.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [HR].[EmployeeContract]
        SET Position      = LTRIM(RTRIM(@Position)),
            PaymentType   = @PaymentType,
            BaseAmount    = @BaseAmount,
            CurrencyCode  = @CurrencyCode,
            StartDate     = @StartDate,
            EndDate       = @EndDate,
            ScheduleNotes = NULLIF(@ScheduleNotes, ''),
            Notes         = NULLIF(@Notes, '')
        WHERE ContractId = @ContractId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'El contrato indicado no existe.', 1;

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
