/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspRecordEmployeePayment]
   SUBDOMAIN:   EmployeePayment
   DESCRIPTION: Registra la liquidación o pago a un empleado (por hora, turno, día, semana, mes)
                VALIDÁNDOLO contra el contrato vigente del empleado:
                  · Pago normal: modalidad y tarifa deben coincidir con el contrato vigente.
                  · Turno extra (@IsExtraShift = 1): se paga por día u hora con una modalidad
                    distinta a la del contrato; no puede duplicarse el mismo día.
                Las deducciones se reciben detalladas en @Deductions (JSON) y se guardan fila a
                fila en [HR].[EmployeeDeduction]; su suma define DeductionsAmount y el neto.
                Si se paga en efectivo desde la caja del turno activo, el egreso contable
                (CashBoxAdjustment OUT con SourceCode = 'Nomina') registra el NETO
                (BaseAmount + BonusAmount − DeductionsAmount).

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos / JSON de deducciones inválido)
    50404 -> Not Found                 (Empleado o sesión de caja no existe)
    50422 -> Conflict/Negocio          (Contrato vigente, duplicado, turno extra o caja cerrada)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspRecordEmployeePayment] (
    @TenantId                UNIQUEIDENTIFIER,
    @LocationId              UNIQUEIDENTIFIER = NULL,
    @EmployeeId              INT,
    @PaymentType             NVARCHAR(20),     -- 'Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly'
    @PeriodStart             DATE,
    @PeriodEnd               DATE,
    @UnitsWorked             DECIMAL(8,2),     -- Horas, turnos o días laborados
    @RateApplied             DECIMAL(18,4),
    @BonusAmount             DECIMAL(18,4) = 0,
    @DeductionsAmount        DECIMAL(18,4) = 0,  -- Compatibilidad: solo se usa si no llega @Deductions
    @CurrencyCode            CHAR(3) = 'NIO',
    @IsExtraShift            BIT = 0,          -- Turno extra pagado fuera del contrato vigente
    @Deductions              NVARCHAR(MAX) = NULL, -- JSON: [{"type":"INSS","description":"...","amount":123.45}]
    @CashBoxSessionId        INT = NULL,       -- Si se pagó con efectivo de la caja del turno activo
    @Notes                   NVARCHAR(500) = NULL,
    @CreatedBy               INT = NULL,
    @InsertedId              INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @EmployeeId IS NULL OR @EmployeeId <= 0
        THROW 50400, N'El ID del empleado no es válido.', 1;

    IF @UnitsWorked IS NULL OR @UnitsWorked <= 0
        THROW 50400, N'Las unidades trabajadas deben ser mayores a cero.', 1;

    IF @PaymentType NOT IN ('Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly')
        THROW 50400, N'La modalidad de pago no es válida. Debe ser Hourly, Daily, PerShift, Weekly o Monthly.', 1;

    IF @PeriodStart IS NULL OR @PeriodEnd IS NULL
        THROW 50400, N'El período del pago es obligatorio.', 1;

    IF @PeriodEnd < @PeriodStart
        THROW 50400, N'La fecha de fin del período no puede ser anterior a la de inicio.', 1;

    SET @IsExtraShift = ISNULL(@IsExtraShift, 0);

    IF NOT EXISTS (SELECT 1 FROM [HR].[Employee] WHERE EmployeeId = @EmployeeId AND TenantId = @TenantId AND IsActive = 1)
        THROW 50404, N'El empleado no existe o está inactivo.', 1;

    DECLARE @EmployeeName NVARCHAR(150);
    DECLARE @EmployeePosition NVARCHAR(100);
    SELECT @EmployeeName = FullName, @EmployeePosition = Position
    FROM [HR].[Employee] WHERE EmployeeId = @EmployeeId;

    -- ── 1. Contrato vigente del empleado para el período que se está pagando ───────────────
    DECLARE @ContractId INT = NULL;
    DECLARE @ContractPaymentType NVARCHAR(20) = NULL;
    DECLARE @ContractBaseAmount DECIMAL(18,4) = NULL;
    DECLARE @ContractLabel NVARCHAR(40) = NULL;

    SELECT TOP 1
        @ContractId          = c.ContractId,
        @ContractPaymentType = c.PaymentType,
        @ContractBaseAmount  = c.BaseAmount
    FROM [HR].[EmployeeContract] AS c
    WHERE c.TenantId = @TenantId
      AND c.EmployeeId = @EmployeeId
      AND c.IsActive = 1
      AND c.StartDate <= @PeriodEnd
      AND (c.EndDate IS NULL OR @PeriodEnd <= c.EndDate)
    ORDER BY c.StartDate DESC, c.ContractId DESC;

    IF @ContractId IS NOT NULL
        SET @ContractLabel = CASE @ContractPaymentType
            WHEN 'Hourly' THEN N'Por Hora'
            WHEN 'Daily' THEN N'Por Día'
            WHEN 'PerShift' THEN N'Por Turno'
            WHEN 'Weekly' THEN N'Semanal'
            WHEN 'Monthly' THEN N'Mensual'
            ELSE @ContractPaymentType
        END;

    IF @ContractId IS NOT NULL
    BEGIN
        IF @IsExtraShift = 1
        BEGIN
            -- Regla 1b: el turno extra va por día u hora y NO puede usar la modalidad del contrato.
            IF @PaymentType NOT IN ('Daily', 'Hourly')
                THROW 50422, N'Un turno extra solo se paga por día (Daily) o por hora (Hourly).', 1;

            IF @PaymentType = @ContractPaymentType
                THROW 50422, N'El turno extra no puede usar la misma modalidad del contrato vigente. Elige «Por día» o «Por hora» u omite la marca de turno extra.', 1;
        END
        ELSE
        BEGIN
            -- Regla 1a: el pago normal debe usar la modalidad del contrato vigente.
            IF @PaymentType <> @ContractPaymentType
            BEGIN
                DECLARE @ModalityMessage NVARCHAR(400) = N'El contrato vigente del empleado es «' + @ContractLabel + N'». Registra el pago con esa modalidad o márcalo como turno extra.';
                THROW 50422, @ModalityMessage, 1;
            END

            -- Regla 2: la tarifa del pago normal debe coincidir con el salario del contrato (± 0.01).
            IF ABS(@RateApplied - @ContractBaseAmount) > 0.01
            BEGIN
                DECLARE @SalaryMessage NVARCHAR(400) = N'La tarifa aplicada no coincide con el salario del contrato vigente (C$ ' + CONVERT(NVARCHAR(40), CONVERT(DECIMAL(18,2), @ContractBaseAmount)) + N'). Ajústala al contrato o registra un turno extra.';
                THROW 50422, @SalaryMessage, 1;
            END
        END
    END
    ELSE
    BEGIN
        -- Regla 3: sin contrato vigente se permite el pago, pero avisando al usuario en el front.
        IF @IsExtraShift = 1 AND @PaymentType NOT IN ('Daily', 'Hourly')
            THROW 50422, N'Un turno extra solo se paga por día (Daily) o por hora (Hourly).', 1;

        IF @PaymentType = 'Monthly' AND @RateApplied <= 0
            THROW 50400, N'Sin contrato vigente, el pago mensual debe indicar una tarifa mayor a cero.', 1;
    END

    -- ── 4/5. Duplicados ────────────────────────────────────────────────────────────────────
    IF @IsExtraShift = 0
       AND EXISTS
       (
           SELECT 1 FROM [HR].[EmployeePayment]
           WHERE TenantId = @TenantId
             AND EmployeeId = @EmployeeId
             AND IsExtraShift = 0
             AND PaymentType = @PaymentType
             AND PeriodStart = @PeriodStart
             AND PeriodEnd = @PeriodEnd
       )
        THROW 50422, N'Ya existe un pago para ese período con esa modalidad. Revisa el historial del empleado antes de registrarlo de nuevo.', 1;

    IF @IsExtraShift = 1
       AND EXISTS
       (
           SELECT 1 FROM [HR].[EmployeePayment]
           WHERE TenantId = @TenantId
             AND EmployeeId = @EmployeeId
             AND IsExtraShift = 1
             AND PeriodStart = @PeriodStart
       )
        THROW 50422, N'Ya existe un turno extra registrado para ese día. Un turno extra no puede duplicarse el mismo día.', 1;

    -- ── Deducciones detalladas (JSON) ──────────────────────────────────────────────────────
    SET @Deductions = NULLIF(LTRIM(RTRIM(@Deductions)), '');

    IF @Deductions IS NOT NULL
    BEGIN
        IF ISJSON(@Deductions) = 0
            THROW 50400, N'Las deducciones no tienen un formato JSON válido.', 1;

        IF EXISTS
        (
            SELECT 1 FROM OPENJSON(@Deductions) WITH (DeductionType NVARCHAR(20) '$.type')
            WHERE DeductionType NOT IN ('INSS', 'IR', 'Prestamo', 'Adelanto', 'Otro')
        )
            THROW 50400, N'Tipo de deducción no válido. Solo se aceptan INSS, IR, Prestamo, Adelanto u Otro.', 1;

        IF EXISTS
        (
            SELECT 1 FROM OPENJSON(@Deductions) WITH (Amount DECIMAL(18,4) '$.amount')
            WHERE Amount IS NULL OR Amount < 0
        )
            THROW 50400, N'Cada deducción debe indicar un monto mayor o igual a cero.', 1;

        SET @DeductionsAmount = ISNULL(
            (SELECT SUM(Amount) FROM OPENJSON(@Deductions) WITH (Amount DECIMAL(18,4) '$.amount')),
            0);
    END

    SET @DeductionsAmount = ISNULL(@DeductionsAmount, 0);
    SET @BonusAmount = ISNULL(@BonusAmount, 0);

    DECLARE @BaseAmount DECIMAL(18,4) = @UnitsWorked * @RateApplied;
    DECLARE @TotalPaid DECIMAL(18,4) = @BaseAmount + @BonusAmount - @DeductionsAmount;

    IF @TotalPaid < 0
        THROW 50400, N'El total pagado no puede ser negativo (las deducciones superan el bruto).', 1;

    -- ── Validar sesión de caja si se liquida en efectivo en el turno ───────────────────────
    IF @CashBoxSessionId IS NOT NULL AND @CashBoxSessionId > 0
    BEGIN
        DECLARE @SessionStatus TINYINT;
        SELECT @SessionStatus = [Status]
        FROM [Finance].[CashBoxSession]
        WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

        IF @SessionStatus IS NULL
            THROW 50404, N'La sesión de caja especificada no existe.', 1;

        IF @SessionStatus <> 1
            THROW 50422, N'La sesión de caja está cerrada. No se puede egresar efectivo de un turno cerrado.', 1;
    END

    DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();
    DECLARE @Rate DECIMAL(18,8) = [Configuration].[fnGetExchangeRateValue](@TenantId, @CurrencyCode, 'NIO');

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        -- 1. Insertar el registro de pago al empleado
        INSERT INTO [HR].[EmployeePayment]
        (
            TenantId,
            LocationId,
            EmployeeId,
            PaymentType,
            PeriodStart,
            PeriodEnd,
            UnitsWorked,
            RateApplied,
            BaseAmount,
            BonusAmount,
            DeductionsAmount,
            TotalPaid,
            CurrencyCode,
            PaidFromCashBoxSessionId,
            IsExtraShift,
            ContractId,
            Notes,
            PaidAtUtc,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @EmployeeId,
            @PaymentType,
            @PeriodStart,
            @PeriodEnd,
            @UnitsWorked,
            @RateApplied,
            @BaseAmount,
            @BonusAmount,
            @DeductionsAmount,
            @TotalPaid,
            @CurrencyCode,
            @CashBoxSessionId,
            @IsExtraShift,
            @ContractId,
            @Notes,
            @NowUtc,
            @CreatedBy
        );

        SET @InsertedId = SCOPE_IDENTITY();

        -- 2. Deducciones detalladas ligadas al pago (si vinieron en el JSON)
        IF @Deductions IS NOT NULL
        BEGIN
            INSERT INTO [HR].[EmployeeDeduction]
            (
                TenantId,
                EmployeeId,
                PaymentId,
                DeductionType,
                Description,
                Amount,
                CurrencyCode,
                AmountInBase,
                AppliedOn,
                Notes,
                CreatedOn,
                CreatedBy
            )
            SELECT
                @TenantId,
                @EmployeeId,
                @InsertedId,
                j.DeductionType,
                NULLIF(j.Description, N''),
                j.Amount,
                @CurrencyCode,
                j.Amount * @Rate,
                @PeriodEnd,
                NULLIF(j.Notes, N''),
                @NowUtc,
                @CreatedBy
            FROM OPENJSON(@Deductions)
                 WITH
                 (
                     DeductionType NVARCHAR(20)  '$.type',
                     Description   NVARCHAR(200) '$.description',
                     Amount        DECIMAL(18,4) '$.amount',
                     Notes         NVARCHAR(300) '$.notes'
                 ) AS j;
        END

        -- 3. Si se pagó de la caja, reflejar el egreso contable del NETO
        IF @CashBoxSessionId IS NOT NULL AND @CashBoxSessionId > 0
        BEGIN
            DECLARE @AmountInBase DECIMAL(18,4) = @TotalPaid * @Rate;
            DECLARE @SourceCode NVARCHAR(30) = N'Nomina';

            INSERT INTO [Finance].[CashBoxAdjustment]
            (
                TenantId,
                CashBoxSessionId,
                AdjustmentType,
                SourceCode,
                CurrencyCode,
                Amount,
                ExchangeRate,
                AmountInBase,
                Reason,
                RecordedAt,
                RecordedBy
            )
            VALUES
            (
                @TenantId,
                @CashBoxSessionId,
                'OUT',
                @SourceCode,
                @CurrencyCode,
                @TotalPaid,          -- NETO: Base + Bono − Deducciones
                @Rate,
                @AmountInBase,
                CONCAT(
                    N'Pago de nómina: ',
                    @EmployeeName,
                    N' (' + CASE @PaymentType
                        WHEN 'Hourly' THEN N'Por hora'
                        WHEN 'Daily' THEN N'Por día'
                        WHEN 'PerShift' THEN N'Por turno'
                        WHEN 'Weekly' THEN N'Semanal'
                        WHEN 'Monthly' THEN N'Mensual'
                        ELSE @PaymentType
                    END
                    + CASE WHEN @IsExtraShift = 1 THEN N', turno extra' ELSE N'' END
                    + N' × ',
                    CAST(@UnitsWorked AS NVARCHAR(20)),
                    N')'
                ),
                @NowUtc,
                @CreatedBy
            );

            UPDATE [Finance].[CashBoxSession]
            SET TotalOutAdjustmentsBase = TotalOutAdjustmentsBase + @AmountInBase
            WHERE CashBoxSessionId = @CashBoxSessionId;
        END

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
