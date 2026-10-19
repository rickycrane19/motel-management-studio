/* Aplicación incremental (idempotente): nómina correcta de El Rapidin.
   - [HR].[EmployeePayment]: columna IsExtraShift (turno extra pagado fuera del contrato)
     y ContractId (contrato vigente con el que se validó/registró el pago).
   - Nueva tabla [HR].[EmployeeDeduction]: deducciones detalladas por pago (INSS, IR,
     Préstamo, Adelanto, Otro) para poder desglosarlas en la nómina.
   NO hace DROP de ninguna tabla existente: solo agrega lo que falta. */
USE [MotelMSDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[HR].[EmployeePayment]') AND name = N'IsExtraShift')
    ALTER TABLE [HR].[EmployeePayment] ADD IsExtraShift BIT NOT NULL CONSTRAINT DF_EmployeePayment_IsExtraShift DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[HR].[EmployeePayment]') AND name = N'ContractId')
    ALTER TABLE [HR].[EmployeePayment] ADD ContractId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EmployeePayment_Contract' AND parent_object_id = OBJECT_ID(N'[HR].[EmployeePayment]'))
    ALTER TABLE [HR].[EmployeePayment] ADD CONSTRAINT FK_EmployeePayment_Contract FOREIGN KEY (ContractId) REFERENCES [HR].[EmployeeContract](ContractId);
GO

IF OBJECT_ID(N'[HR].[EmployeeDeduction]', 'U') IS NULL
BEGIN
    CREATE TABLE [HR].[EmployeeDeduction]
    (
        DeductionId     INT IDENTITY(1,1) NOT NULL,
        TenantId        UNIQUEIDENTIFIER  NOT NULL,
        EmployeeId      INT               NOT NULL,
        PaymentId       INT               NULL,
        DeductionType   NVARCHAR(20)      NOT NULL, -- 'INSS', 'IR', 'Prestamo', 'Adelanto', 'Otro'
        Description     NVARCHAR(200)     NULL,
        Amount          DECIMAL(18,4)     NOT NULL,
        CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_EmployeeDeduction_Currency DEFAULT 'NIO',
        AmountInBase    DECIMAL(18,4)     NOT NULL,
        AppliedOn       DATE              NOT NULL,
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EmployeeDeduction_Tenant_Employee_AppliedOn' AND object_id = OBJECT_ID(N'[HR].[EmployeeDeduction]'))
    CREATE INDEX IX_EmployeeDeduction_Tenant_Employee_AppliedOn ON [HR].[EmployeeDeduction] (TenantId, EmployeeId, AppliedOn);
GO

/* Backfill idempotente: los pagos históricos sin detalle que se pagaron con una modalidad
   distinta a la del contrato vigente en su periodo son, por definición, turnos extra. */
UPDATE p
SET p.IsExtraShift = 1
FROM [HR].[EmployeePayment] AS p
WHERE p.IsExtraShift = 0
  AND p.PaymentType IN ('Daily', 'Hourly')
  AND EXISTS
  (
      SELECT 1
      FROM [HR].[EmployeeContract] AS c
      WHERE c.EmployeeId = p.EmployeeId
        AND c.TenantId = p.TenantId
        AND c.IsActive = 1
        AND c.StartDate <= p.PeriodEnd
        AND (c.EndDate IS NULL OR p.PeriodEnd <= c.EndDate)
        AND c.PaymentType <> p.PaymentType
  );
GO

/* Backfill idempotente: enlaza cada pago histórico con su contrato vigente (si lo tiene). */
UPDATE p
SET p.ContractId = c.ContractId
FROM [HR].[EmployeePayment] AS p
CROSS APPLY
(
    SELECT TOP 1 ec.ContractId
    FROM [HR].[EmployeeContract] AS ec
    WHERE ec.EmployeeId = p.EmployeeId
      AND ec.TenantId = p.TenantId
      AND ec.IsActive = 1
      AND ec.StartDate <= p.PeriodEnd
      AND (ec.EndDate IS NULL OR p.PeriodEnd <= ec.EndDate)
    ORDER BY ec.StartDate DESC, ec.ContractId DESC
) AS c
WHERE p.ContractId IS NULL;
GO
