USE [MotelMSDB];
GO

IF OBJECT_ID(N'HR.EmployeePayment', 'U') IS NOT NULL DROP TABLE [HR].[EmployeePayment];
IF OBJECT_ID(N'HR.Employee', 'U') IS NOT NULL DROP TABLE [HR].[Employee];
GO

CREATE TABLE [HR].[Employee]
(
    EmployeeId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    FullName        NVARCHAR(150)     NOT NULL,
    Position        NVARCHAR(100)     NOT NULL, -- 'Recepcionista', 'Mucama / Limpieza', 'Seguridad', 'Mantenimiento', 'Administrador'
    PaymentType     NVARCHAR(20)      NOT NULL CONSTRAINT DF_Employee_PayType DEFAULT 'PerShift', -- 'Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly'
    Rate            DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Employee_Rate DEFAULT 0,
    CommissionRatePercent DECIMAL(5,2) NOT NULL CONSTRAINT DF_Employee_Commission DEFAULT 0, -- % de comisión sobre las ventas cobradas (0-100)
    CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_Employee_Currency DEFAULT 'NIO',
    Phone           NVARCHAR(50)      NULL,
    IsActive        BIT               NOT NULL CONSTRAINT DF_Employee_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Employee_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Employee PRIMARY KEY CLUSTERED (EmployeeId),
    CONSTRAINT FK_Employee_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Employee_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT CK_Employee_PaymentType CHECK (PaymentType IN ('Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly')),
    CONSTRAINT CK_Employee_Commission CHECK (CommissionRatePercent >= 0 AND CommissionRatePercent <= 100)
);
GO

CREATE TABLE [HR].[EmployeePayment]
(
    PaymentId             INT IDENTITY(1,1) NOT NULL,
    TenantId              UNIQUEIDENTIFIER  NOT NULL,
    LocationId            UNIQUEIDENTIFIER  NULL,
    EmployeeId            INT               NOT NULL,
    PaymentType           NVARCHAR(20)      NOT NULL,
    PeriodStart           DATE              NOT NULL,
    PeriodEnd             DATE              NOT NULL,
    UnitsWorked           DECIMAL(8,2)      NOT NULL CONSTRAINT DF_Pay_Units DEFAULT 1, -- Horas, días o turnos
    RateApplied           DECIMAL(18,4)     NOT NULL,
    BaseAmount            DECIMAL(18,4)     NOT NULL,
    BonusAmount           DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Pay_Bonus DEFAULT 0,
    DeductionsAmount      DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Pay_Deductions DEFAULT 0,
    TotalPaid             DECIMAL(18,4)     NOT NULL,
    CurrencyCode          CHAR(3)           NOT NULL CONSTRAINT DF_Pay_Currency DEFAULT 'NIO',
    PaidFromCashBoxSessionId INT            NULL, -- Si se pagó de la caja física del turno como egreso
    IsExtraShift          BIT               NOT NULL CONSTRAINT DF_EmployeePayment_IsExtraShift DEFAULT 0, -- Turno extra pagado fuera del contrato vigente
    ContractId            INT               NULL, -- Contrato vigente aplicado (FK incremental, ver _incremental/HR Employee Deduction.sql)
    Notes                 NVARCHAR(500)     NULL,
    PaidAtUtc             DATETIME2         NOT NULL CONSTRAINT DF_Pay_PaidAt DEFAULT SYSUTCDATETIME(),
    CreatedBy             INT               NULL,

    CONSTRAINT PK_EmployeePayment PRIMARY KEY CLUSTERED (PaymentId),
    CONSTRAINT FK_EmployeePayment_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_EmployeePayment_Employee FOREIGN KEY (EmployeeId) REFERENCES [HR].[Employee](EmployeeId),
    CONSTRAINT FK_EmployeePayment_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT FK_EmployeePayment_CashSession FOREIGN KEY (PaidFromCashBoxSessionId) REFERENCES [Finance].[CashBoxSession](CashBoxSessionId)
);
GO

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]
   Tabla: [HR].[EmployeeContract]
   Contratos laborales (mensual, diario, por turno, etc.). El salario del contrato alimenta
   la nómina y las sugerencias de turno extra; los pagos extra por día salen de la caja.
   El puesto y la modalidad se congelan en el contrato: puede diferir del dato "actual"
   del empleado. Un contrato inactivo queda como historial para reportes de nómina.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID(N'HR.EmployeeContract', 'U') IS NOT NULL DROP TABLE [HR].[EmployeeContract];
GO

CREATE TABLE [HR].[EmployeeContract]
(
    ContractId     INT IDENTITY(1,1) NOT NULL,
    TenantId       UNIQUEIDENTIFIER  NOT NULL,
    EmployeeId     INT               NOT NULL,
    Position       NVARCHAR(100)     NOT NULL,  -- Puesto del contrato; puede cambiar respecto al del empleado
    PaymentType    NVARCHAR(20)      NOT NULL,  -- 'Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly'
    BaseAmount     DECIMAL(18,4)     NOT NULL,  -- Salario mensual o tarifa base del contrato
    CurrencyCode   CHAR(3)           NOT NULL CONSTRAINT DF_Contract_Currency DEFAULT 'NIO',
    StartDate      DATE              NOT NULL,
    EndDate        DATE              NULL,      -- NULL = indefinido
    IsActive       BIT               NOT NULL CONSTRAINT DF_Contract_IsActive DEFAULT 1,
    ScheduleNotes  NVARCHAR(300)     NULL,      -- Horario: Ej. "Martes a sábado, 10pm-6am"
    Notes          NVARCHAR(500)     NULL,
    CreatedOn      DATETIME2         NOT NULL CONSTRAINT DF_Contract_CreatedOn DEFAULT SYSUTCDATETIME(),
    CreatedBy      INT               NULL,      -- Usuario del tenant que registró el contrato

    CONSTRAINT PK_EmployeeContract PRIMARY KEY CLUSTERED (ContractId),
    CONSTRAINT FK_EmployeeContract_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_EmployeeContract_Employee FOREIGN KEY (EmployeeId) REFERENCES [HR].[Employee](EmployeeId),
    CONSTRAINT FK_EmployeeContract_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT CK_EmployeeContract_PaymentType CHECK (PaymentType IN ('Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly')),
    CONSTRAINT CK_EmployeeContract_Dates CHECK ([EndDate] IS NULL OR [EndDate] >= [StartDate])
);
GO

CREATE INDEX IX_EmployeeContract_Tenant_Employee ON [HR].[EmployeeContract] (TenantId, EmployeeId, IsActive);
GO

-- El pago apunta al contrato vigente con el que se validó. La FK se agrega aquí (no inline en
-- EmployeePayment) porque EmployeeContract se crea después en este mismo script.
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EmployeePayment_Contract' AND parent_object_id = OBJECT_ID(N'[HR].[EmployeePayment]'))
    ALTER TABLE [HR].[EmployeePayment] ADD CONSTRAINT FK_EmployeePayment_Contract FOREIGN KEY (ContractId) REFERENCES [HR].[EmployeeContract](ContractId);
GO

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- [ HR ] — Employee.CommissionRatePercent: porcentaje de comisión del empleado sobre las ventas
-- cobradas en sus turnos (0-100). Lo usa el reporte de rendimiento por cajero para calcular
-- «Comisión a pagar» = ventas cobradas × CommissionRatePercent / 100. Idempotente para bases ya
-- creadas: si la columna no existe se agrega con valor 0.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[HR].[Employee]') AND name = N'CommissionRatePercent')
    ALTER TABLE [HR].[Employee] ADD CommissionRatePercent DECIMAL(5,2) NOT NULL CONSTRAINT DF_Employee_Commission DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Employee_Commission' AND parent_object_id = OBJECT_ID(N'[HR].[Employee]'))
    ALTER TABLE [HR].[Employee] ADD CONSTRAINT CK_Employee_Commission CHECK (CommissionRatePercent >= 0 AND CommissionRatePercent <= 100);
GO

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]
   Tabla: [HR].[EmployeeDeduction]
   Deducciones detalladas de un pago de nómina (INSS, IR, préstamo, adelanto, otro). Cada fila
   cuelga del pago (PaymentId) y del empleado, y se aplica sobre el período del pago. El total
   del pago (EmployeePayment.DeductionsAmount) es la suma de sus deducciones; el neto que sale
   de la caja del turno es Base + Bono − Deducciones.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID(N'HR.EmployeeDeduction', 'U') IS NULL
BEGIN
    CREATE TABLE [HR].[EmployeeDeduction]
    (
        DeductionId     INT IDENTITY(1,1) NOT NULL,
        TenantId        UNIQUEIDENTIFIER  NOT NULL,
        EmployeeId      INT               NOT NULL,
        PaymentId       INT               NULL,      -- Pago al que se aplica la deducción
        DeductionType   NVARCHAR(20)      NOT NULL,  -- 'INSS', 'IR', 'Prestamo', 'Adelanto', 'Otro'
        Description     NVARCHAR(200)     NULL,
        Amount          DECIMAL(18,4)     NOT NULL,  -- Monto en la moneda del pago
        CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_EmployeeDeduction_Currency DEFAULT 'NIO',
        AmountInBase    DECIMAL(18,4)     NOT NULL,  -- Monto convertido a moneda base (NIO)
        AppliedOn       DATE              NOT NULL,  -- Fecha a la que corresponde la deducción
        Notes           NVARCHAR(300)     NULL,
        CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_EmployeeDeduction_CreatedOn DEFAULT SYSUTCDATETIME(),
        CreatedBy       INT               NULL,

        CONSTRAINT PK_EmployeeDeduction PRIMARY KEY CLUSTERED (DeductionId),
        CONSTRAINT FK_EmployeeDeduction_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
        CONSTRAINT FK_EmployeeDeduction_Employee FOREIGN KEY (EmployeeId) REFERENCES [HR].[Employee](EmployeeId),
        CONSTRAINT FK_EmployeeDeduction_Payment FOREIGN KEY (PaymentId) REFERENCES [HR].[EmployeePayment](PaymentId),
        CONSTRAINT FK_EmployeeDeduction_Currency FOREIGN KEY (CurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
        CONSTRAINT CK_EmployeeDeduction_Type CHECK (DeductionType IN ('INSS', 'IR', 'Prestamo', 'Adelanto', 'Otro'))
    );

    CREATE INDEX IX_EmployeeDeduction_Tenant_Employee_AppliedOn ON [HR].[EmployeeDeduction] (TenantId, EmployeeId, AppliedOn);
END
GO

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]
   Tabla: [HR].[CommissionRule]
   Reglas de comisión con reglas múltiples: por empleado, por puesto/rol o generales
   (ScopeType = 'Employee' | 'Position' | 'All'). Cada regla cubre un TRAMO de monto
   (MinAmount inclusive / MaxAmount exclusivo, NULL = sin tope) para una MÉTRICA
   (Sales | Stays | Products | Tips) y una vigencia (StartDate/EndDate).

   La resolución en el reporte de rendimiento por cajero es por prioridad de alcance
   (Employee > Position > All) y, dentro del alcance, por el tramo alcanzado: la regla con
   el mayor MinAmount que sea <= al total de su métrica. El porcentaje se aplica sobre el
   total de esa métrica. Si no aplica ninguna regla, se usa el valor heredado
   [HR].[Employee].[CommissionRatePercent].

   Nota: se aplica en bases existentes con el script incremental idempotente
   Database\01 - Tables\_incremental\HR Commission Rules.sql (este archivo no se ejecuta).
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
IF OBJECT_ID(N'HR.CommissionRule', 'U') IS NOT NULL DROP TABLE [HR].[CommissionRule];
GO

CREATE TABLE [HR].[CommissionRule]
(
    RuleId        INT IDENTITY(1,1) NOT NULL,
    TenantId      UNIQUEIDENTIFIER  NOT NULL,
    Name          NVARCHAR(120)     NOT NULL,
    ScopeType     NVARCHAR(20)      NOT NULL,                      -- 'Employee' | 'Position' | 'All'
    EmployeeId    INT               NULL,                          -- Obligatorio si ScopeType = 'Employee'
    Position      NVARCHAR(100)     NULL,                          -- Obligatorio si ScopeType = 'Position'
    MetricType    NVARCHAR(20)      NOT NULL CONSTRAINT DF_CommissionRule_Metric DEFAULT 'Sales', -- 'Sales' | 'Stays' | 'Products' | 'Tips'
    MinAmount     DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CommissionRule_Min DEFAULT 0,          -- Inicio del tramo (inclusive)
    MaxAmount     DECIMAL(18,4)     NULL,                          -- Fin del tramo (exclusivo); NULL = sin tope
    RatePercent   DECIMAL(5,2)      NOT NULL,                      -- Porcentaje aplicado al total de la métrica (0-100)
    StartDate     DATE              NOT NULL,
    EndDate       DATE              NULL,                          -- NULL = vigencia indefinida
    IsActive      BIT               NOT NULL CONSTRAINT DF_CommissionRule_IsActive DEFAULT 1,
    Notes         NVARCHAR(300)     NULL,
    CreatedOn     DATETIME2         NOT NULL CONSTRAINT DF_CommissionRule_CreatedOn DEFAULT SYSUTCDATETIME(),
    CreatedBy     INT               NULL,

    CONSTRAINT PK_CommissionRule PRIMARY KEY CLUSTERED (RuleId),
    CONSTRAINT FK_CommissionRule_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_CommissionRule_Employee FOREIGN KEY (EmployeeId) REFERENCES [HR].[Employee](EmployeeId),
    CONSTRAINT CK_CommissionRule_ScopeType CHECK (ScopeType IN ('Employee', 'Position', 'All')),
    CONSTRAINT CK_CommissionRule_MetricType CHECK (MetricType IN ('Sales', 'Stays', 'Products', 'Tips')),
    CONSTRAINT CK_CommissionRule_Rate CHECK (RatePercent >= 0 AND RatePercent <= 100),
    CONSTRAINT CK_CommissionRule_Min CHECK (MinAmount >= 0),
    CONSTRAINT CK_CommissionRule_Range CHECK (MaxAmount IS NULL OR MaxAmount > MinAmount),
    CONSTRAINT CK_CommissionRule_Dates CHECK (EndDate IS NULL OR EndDate >= StartDate),
    CONSTRAINT CK_CommissionRule_Scope CHECK (
        (ScopeType = 'Employee' AND EmployeeId IS NOT NULL AND Position IS NULL)
        OR (ScopeType = 'Position' AND Position IS NOT NULL AND EmployeeId IS NULL)
        OR (ScopeType = 'All' AND EmployeeId IS NULL AND Position IS NULL)
    )
);
GO

CREATE INDEX IX_CommissionRule_Tenant_Active ON [HR].[CommissionRule] (TenantId, IsActive, ScopeType, MetricType);
GO
