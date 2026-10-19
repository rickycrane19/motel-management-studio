/* ══════════════════════════════════════════════════════════════════════════════════════════════
   Aplicación incremental (idempotente) — COMISIONES CON REGLAS MÚLTIPLES
   [HR].[CommissionRule]: reglas de comisión por empleado, por puesto o generales
   (ScopeType = 'Employee' | 'Position' | 'All'), con rangos de monto (MinAmount/MaxAmount)
   por métrica (Sales/Stays/Products/Tips) y vigencia (StartDate/EndDate).
   Reemplaza el uso del único campo [HR].[Employee].CommissionRatePercent, que queda como
   valor heredado de respaldo cuando no aplica ninguna regla.

   No ejecuta DROP: crea la tabla y el índice solo si no existen.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE [MotelMSDB];
GO

IF OBJECT_ID(N'HR.CommissionRule', 'U') IS NULL
BEGIN
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
        -- Coherencia de alcance: el campo del alcance es obligatorio y los demás quedan en NULL.
        CONSTRAINT CK_CommissionRule_Scope CHECK (
            (ScopeType = 'Employee' AND EmployeeId IS NOT NULL AND Position IS NULL)
            OR (ScopeType = 'Position' AND Position IS NOT NULL AND EmployeeId IS NULL)
            OR (ScopeType = 'All' AND EmployeeId IS NULL AND Position IS NULL)
        )
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CommissionRule_Tenant_Active' AND object_id = OBJECT_ID(N'[HR].[CommissionRule]'))
    CREATE INDEX IX_CommissionRule_Tenant_Active ON [HR].[CommissionRule] (TenantId, IsActive, ScopeType, MetricType);
GO
