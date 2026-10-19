USE [MotelMSDB];
GO

IF OBJECT_ID(N'Finance.CashBoxAdjustment', 'U') IS NOT NULL DROP TABLE [Finance].[CashBoxAdjustment];
IF OBJECT_ID(N'Finance.CashBoxCount', 'U') IS NOT NULL DROP TABLE [Finance].[CashBoxCount];
IF OBJECT_ID(N'Finance.CashBoxSession', 'U') IS NOT NULL DROP TABLE [Finance].[CashBoxSession];
IF OBJECT_ID(N'Finance.CashBoxDenomination', 'U') IS NOT NULL DROP TABLE [Finance].[CashBoxDenomination];
IF OBJECT_ID(N'Finance.CashBox', 'U') IS NOT NULL DROP TABLE [Finance].[CashBox];
GO

CREATE TABLE [Finance].[CashBox]
(
    CashBoxId       INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    Name            NVARCHAR(100)     NOT NULL,
    Code            NVARCHAR(20)      NOT NULL,
    IsActive        BIT               NOT NULL CONSTRAINT DF_CashBox_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_CashBox_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_CashBox PRIMARY KEY CLUSTERED (CashBoxId),
    CONSTRAINT FK_CashBox_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId)
);
GO

CREATE TABLE [Finance].[CashBoxDenomination]
(
    DenominationId  INT IDENTITY(1,1) NOT NULL,
    CurrencyCode    CHAR(3)           NOT NULL,
    [Value]         DECIMAL(18,4)     NOT NULL,
    Label           NVARCHAR(50)      NOT NULL,
    IsActive        BIT               NOT NULL CONSTRAINT DF_Denom_IsActive DEFAULT 1,

    CONSTRAINT PK_CashBoxDenomination PRIMARY KEY CLUSTERED (DenominationId),
    CONSTRAINT FK_CashBoxDenomination_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT UQ_CashBoxDenomination_CurrencyValue UNIQUE (CurrencyCode, [Value])
);
GO

CREATE TABLE [Finance].[CashBoxSession]
(
    CashBoxSessionId      INT IDENTITY(1,1) NOT NULL,
    TenantId              UNIQUEIDENTIFIER  NOT NULL,
    LocationId            UNIQUEIDENTIFIER  NULL,
    CashBoxId             INT               NOT NULL,
    UserId                INT               NOT NULL,
    ShiftName             NVARCHAR(50)      NOT NULL CONSTRAINT DF_CBSession_Shift DEFAULT 'Turno 1',
    OpenedAtUtc           DATETIME2         NOT NULL CONSTRAINT DF_CBSession_Opened DEFAULT SYSUTCDATETIME(),
    ClosedAtUtc           DATETIME2         NULL,
    [Status]              TINYINT           NOT NULL CONSTRAINT DF_CBSession_Status DEFAULT 1, -- 1 = Abierta, 2 = Cerrada
    OpeningBalanceBase    DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CBSession_OpenBal DEFAULT 0,
    TotalSalesBase        DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CBSession_Sales DEFAULT 0,
    TotalInAdjustmentsBase DECIMAL(18,4)    NOT NULL CONSTRAINT DF_CBSession_InAdj DEFAULT 0,
    TotalOutAdjustmentsBase DECIMAL(18,4)   NOT NULL CONSTRAINT DF_CBSession_OutAdj DEFAULT 0,
    ClosingCalculatedBase DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CBSession_CloseCalc DEFAULT 0,
    ClosingActualBase     DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CBSession_CloseAct DEFAULT 0,
    DifferenceBase        DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CBSession_Diff DEFAULT 0, -- Sobrante (+), Faltante (-), Cuadrada (0)
    Notes                 NVARCHAR(500)     NULL,

    CONSTRAINT PK_CashBoxSession PRIMARY KEY CLUSTERED (CashBoxSessionId),
    CONSTRAINT FK_CashBoxSession_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_CashBoxSession_CashBox FOREIGN KEY (CashBoxId) REFERENCES [Finance].[CashBox](CashBoxId),
    CONSTRAINT FK_CashBoxSession_User FOREIGN KEY (UserId) REFERENCES [Security].[User](UserId)
);
GO

CREATE TABLE [Finance].[CashBoxCount]
(
    CashBoxCountId        INT IDENTITY(1,1) NOT NULL,
    TenantId              UNIQUEIDENTIFIER  NOT NULL,
    CashBoxSessionId      INT               NOT NULL,
    CountTypeId           INT               NOT NULL, -- 1 = Apertura, 2 = Pre-Arqueo, 3 = Cierre
    DenominationId        INT               NOT NULL,
    [Count]               INT               NOT NULL CONSTRAINT DF_CashCount_Count DEFAULT 0,
    SubTotal              DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CashCount_SubTotal DEFAULT 0,
    SubTotalInBase        DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CashCount_SubTotalBase DEFAULT 0,
    RecordedAt            DATETIME2         NOT NULL CONSTRAINT DF_CashCount_Recorded DEFAULT SYSUTCDATETIME(),
    RecordedBy            INT               NULL,

    CONSTRAINT PK_CashBoxCount PRIMARY KEY CLUSTERED (CashBoxCountId),
    CONSTRAINT FK_CashBoxCount_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_CashBoxCount_Session FOREIGN KEY (CashBoxSessionId) REFERENCES [Finance].[CashBoxSession](CashBoxSessionId),
    CONSTRAINT FK_CashBoxCount_Denomination FOREIGN KEY (DenominationId) REFERENCES [Finance].[CashBoxDenomination](DenominationId)
);
GO

CREATE TABLE [Finance].[CashBoxAdjustment]
(
    AdjustmentId          INT IDENTITY(1,1) NOT NULL,
    TenantId              UNIQUEIDENTIFIER  NOT NULL,
    CashBoxSessionId      INT               NOT NULL,
    AdjustmentType        NVARCHAR(10)      NOT NULL, -- 'IN' (Entrada de efectivo), 'OUT' (Salida / Gasto de efectivo)
    CurrencyCode          CHAR(3)           NOT NULL,
    Amount                DECIMAL(18,4)     NOT NULL,
    ExchangeRate          DECIMAL(18,8)     NOT NULL CONSTRAINT DF_Adj_Rate DEFAULT 1.0,
    AmountInBase          DECIMAL(18,4)     NOT NULL,
    Reason                NVARCHAR(250)     NOT NULL,
    RecordedAt            DATETIME2         NOT NULL CONSTRAINT DF_Adj_Recorded DEFAULT SYSUTCDATETIME(),
    RecordedBy            INT               NULL,

    CONSTRAINT PK_CashBoxAdjustment PRIMARY KEY CLUSTERED (AdjustmentId),
    CONSTRAINT FK_CashBoxAdjustment_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_CashBoxAdjustment_Session FOREIGN KEY (CashBoxSessionId) REFERENCES [Finance].[CashBoxSession](CashBoxSessionId),
    CONSTRAINT FK_CashBoxAdjustment_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT CK_Adjustment_Type CHECK (AdjustmentType IN ('IN', 'OUT'))
);
GO

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- [ FINANCE ] — FinancialLoss: pérdidas registrables del negocio (daño de cuarto, minibar,
-- faltante de caja u otro). Es un registro inmutable de propósito contable/reportes; no se
-- edita ni se borra. Por design, el reporte financiero lee las pérdidas DIRECTO de esta fuente
-- (no vía ajustes de caja) y los ajustes OUT asociados quedan marcados SourceCode = 'Perdida'.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE [Finance].[FinancialLoss]
(
    LossId          INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    CategoryCode    NVARCHAR(30)      NOT NULL, -- 'Habitacion' (daño de cuarto), 'Minibar' (mala gestión de producto), 'Caja' (faltante), 'Otro'
    RoomId          INT               NULL,
    RoomStayId      INT               NULL,
    [Description]   NVARCHAR(300)     NOT NULL,
    Amount          DECIMAL(18,4)     NOT NULL,
    CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_FinLoss_Currency DEFAULT 'NIO',
    AmountInBase    DECIMAL(18,4)     NOT NULL CONSTRAINT DF_FinLoss_AmountBase DEFAULT 0,
    ExchangeRate    DECIMAL(18,8)     NOT NULL CONSTRAINT DF_FinLoss_Rate DEFAULT 1.0,
    CashBoxSessionId INT              NULL,
    RecordedAtUtc   DATETIME2         NOT NULL CONSTRAINT DF_FinLoss_Recorded DEFAULT SYSUTCDATETIME(),
    CreatedBy       INT               NULL,

    CONSTRAINT PK_FinancialLoss PRIMARY KEY CLUSTERED (LossId),
    CONSTRAINT FK_FinancialLoss_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_FinancialLoss_Room FOREIGN KEY (RoomId) REFERENCES [Service].[Room](RoomId),
    CONSTRAINT FK_FinancialLoss_RoomStay FOREIGN KEY (RoomStayId) REFERENCES [Service].[RoomStay](RoomStayId),
    CONSTRAINT FK_FinancialLoss_Session FOREIGN KEY (CashBoxSessionId) REFERENCES [Finance].[CashBoxSession](CashBoxSessionId),
    CONSTRAINT FK_FinancialLoss_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT CK_FinancialLoss_Category CHECK (CategoryCode IN ('Habitacion', 'Minibar', 'Caja', 'Otro')),
    CONSTRAINT CK_FinancialLoss_Amount CHECK (Amount > 0)
);
GO

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- [ FINANCE ] — CashBoxAdjustment.SourceCode: origen del ajuste de caja para que los reportes
-- consolidados separen «gastos manuales» de los egresos que ya se leen por su fuente
-- ('Compra', 'Proveedor', 'Cliente', 'Nomina', 'Perdida', ...). Las filas históricas sin origen
-- quedan como 'AjusteManual' (el ajuste manual existen en el endpoint POST /sessions/.../adjustments).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Finance].[CashBoxAdjustment]') AND name = N'SourceCode')
    ALTER TABLE [Finance].[CashBoxAdjustment] ADD SourceCode NVARCHAR(60) NULL;
GO

-- Normaliza el ancho a 60 caracteres en bases creadas antes (acepta 'AjusteManual', 'Propina',
-- 'Comision', 'Otro', 'Compra', 'Proveedor', 'Cliente', 'Nomina', 'Perdida').
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Finance].[CashBoxAdjustment]') AND name = N'SourceCode' AND max_length < 120)
    ALTER TABLE [Finance].[CashBoxAdjustment] ALTER COLUMN SourceCode NVARCHAR(60) NULL;

-- Backfill de filas históricas: el único ajuste automatizado previo que existía es la nómina
-- pagada desde caja (padrón 'Pago de empleado (Pago #x)' de [HR].[uspRecordEmployeePayment]);
-- ese egreso se lee por fuente EmployeePayment, así que se marca 'Nomina' para no doble contarlo.
UPDATE [Finance].[CashBoxAdjustment]
SET SourceCode = CASE WHEN Reason LIKE N'Pago de empleado%' THEN N'Nomina' ELSE N'AjusteManual' END
WHERE SourceCode IS NULL;
GO
