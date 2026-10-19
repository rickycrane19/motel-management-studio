/* Aplicación incremental (idempotente) de: FinancialLoss + CashBoxAdjustment.SourceCode */
USE [MotelMSDB];
GO

IF OBJECT_ID(N'Finance.FinancialLoss', 'U') IS NULL
BEGIN
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Finance].[CashBoxAdjustment]') AND name = N'SourceCode')
    ALTER TABLE [Finance].[CashBoxAdjustment] ADD SourceCode NVARCHAR(30) NULL;
GO

-- Backfill de filas históricas: antes solo la nómina pagada desde caja generaba ajustes
-- automatizados ('Pago de empleado (Pago #x)' de [HR].[uspRecordEmployeePayment]); ese egreso
-- se lee por fuente EmployeePayment, así que se marca 'Nomina' para no doble contarlo.
UPDATE [Finance].[CashBoxAdjustment]
SET SourceCode = CASE WHEN Reason LIKE N'Pago de empleado%' THEN N'Nomina' ELSE N'AjusteManual' END
WHERE SourceCode IS NULL;
GO
