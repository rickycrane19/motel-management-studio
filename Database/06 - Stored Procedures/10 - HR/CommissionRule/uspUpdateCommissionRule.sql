/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspUpdateCommissionRule]
   SUBDOMAIN:   CommissionRule
   DESCRIPTION: Actualiza una regla de comisión (alcance, empleado/puesto, métrica, tramo de
                monto, porcentaje, vigencia y notas). El estado activo se cambia aparte con
                [HR].[uspSetCommissionRuleActive]. La regla no puede solaparse con otro tramo
                activo del mismo alcance + métrica + vigencia.

   ──────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Regla o empleado no existe)
    50422 -> Conflict                  (Tramo solapado con otra regla activa)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspUpdateCommissionRule] (
    @TenantId    UNIQUEIDENTIFIER,
    @RuleId      INT,
    @Name        NVARCHAR(120),
    @ScopeType   NVARCHAR(20),        -- 'Employee', 'Position', 'All'
    @EmployeeId  INT            = NULL,
    @Position    NVARCHAR(100)  = NULL,
    @MetricType  NVARCHAR(20)   = 'Sales',  -- 'Sales', 'Stays', 'Products', 'Tips'
    @MinAmount   DECIMAL(18,4)  = 0,
    @MaxAmount   DECIMAL(18,4)  = NULL,
    @RatePercent DECIMAL(5,2),
    @StartDate   DATE,
    @EndDate     DATE           = NULL,
    @Notes       NVARCHAR(300)  = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RuleId IS NULL OR @RuleId <= 0
        THROW 50400, N'La regla de comisión indicada no es válida.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre de la regla de comisión es obligatorio.', 1;

    IF @ScopeType NOT IN ('Employee', 'Position', 'All')
        THROW 50400, N'El alcance de la regla no es válido. Debe ser Employee, Position o All.', 1;

    IF @MetricType NOT IN ('Sales', 'Stays', 'Products', 'Tips')
        THROW 50400, N'La métrica de la regla no es válida. Debe ser Sales, Stays, Products o Tips.', 1;

    IF @RatePercent IS NULL OR @RatePercent < 0 OR @RatePercent > 100
        THROW 50400, N'El porcentaje de comisión debe estar entre 0 y 100.', 1;

    IF @MinAmount IS NULL OR @MinAmount < 0
        THROW 50400, N'El monto mínimo del tramo no puede ser negativo.', 1;

    IF @MaxAmount IS NOT NULL AND @MaxAmount <= @MinAmount
        THROW 50400, N'El monto máximo del tramo debe ser mayor que el mínimo (o quedar vacío si no hay tope).', 1;

    IF @StartDate IS NULL
        THROW 50400, N'La fecha de inicio de vigencia es obligatoria.', 1;

    IF @EndDate IS NOT NULL AND @EndDate < @StartDate
        THROW 50400, N'La fecha de fin no puede ser anterior a la fecha de inicio.', 1;

    SET @Name = LTRIM(RTRIM(@Name));
    SET @Position = NULLIF(LTRIM(RTRIM(@Position)), '');

    IF @ScopeType = 'Employee'
    BEGIN
        IF @EmployeeId IS NULL OR @EmployeeId <= 0
            THROW 50400, N'Para una regla por empleado debes indicar el empleado.', 1;

        IF NOT EXISTS (SELECT 1 FROM [HR].[Employee] WHERE EmployeeId = @EmployeeId AND TenantId = @TenantId)
            THROW 50404, N'El empleado indicado no existe.', 1;

        SET @Position = NULL;
    END
    ELSE IF @ScopeType = 'Position'
    BEGIN
        IF @Position IS NULL
            THROW 50400, N'Para una regla por puesto debes indicar el puesto.', 1;

        SET @EmployeeId = NULL;
    END
    ELSE
    BEGIN
        SET @EmployeeId = NULL;
        SET @Position = NULL;
    END

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM [HR].[CommissionRule] WHERE RuleId = @RuleId AND TenantId = @TenantId)
            THROW 50404, N'La regla de comisión indicada no existe.', 1;

        /* Tramos activos solapados del mismo alcance + métrica + vigencia, excluyendo esta regla. */
        IF EXISTS (
            SELECT 1
            FROM [HR].[CommissionRule] AS r
            WHERE r.TenantId = @TenantId
              AND r.RuleId <> @RuleId
              AND r.IsActive = 1
              AND r.ScopeType = @ScopeType
              AND r.MetricType = @MetricType
              AND ((@ScopeType = 'Employee' AND r.EmployeeId = @EmployeeId)
                OR (@ScopeType = 'Position' AND r.Position = @Position)
                OR (@ScopeType = 'All'))
              AND r.StartDate <= COALESCE(@EndDate, '9999-12-31')
              AND COALESCE(r.EndDate, '9999-12-31') >= @StartDate
              AND (@MaxAmount IS NULL OR r.MinAmount < @MaxAmount)
              AND (r.MaxAmount IS NULL OR @MinAmount < r.MaxAmount)
        )
            THROW 50422, N'Ya existe una regla activa que cubre ese tramo de monto para el mismo alcance, métrica y vigencia. Ajusta el rango o la vigencia.', 1;

        UPDATE [HR].[CommissionRule]
        SET Name        = @Name,
            ScopeType   = @ScopeType,
            EmployeeId  = @EmployeeId,
            Position    = @Position,
            MetricType  = @MetricType,
            MinAmount   = @MinAmount,
            MaxAmount   = @MaxAmount,
            RatePercent = @RatePercent,
            StartDate   = @StartDate,
            EndDate     = @EndDate,
            Notes       = NULLIF(LTRIM(RTRIM(@Notes)), '')
        WHERE RuleId = @RuleId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'La regla de comisión indicada no existe.', 1;

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
