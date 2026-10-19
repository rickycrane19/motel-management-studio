/* Aplicación incremental (idempotente): reporte de rendimiento por cajero.
   - [Finance].[CashBoxAdjustment].SourceCode se normaliza a NVARCHAR(60) para aceptar
     'AjusteManual' | 'Propina' | 'Comision' | 'Otro' además de las fuentes automáticas.
   - [HR].[Employee].CommissionRatePercent (% de comisión sobre ventas cobradas, 0-100). */
USE [MotelMSDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Finance].[CashBoxAdjustment]') AND name = N'SourceCode')
    ALTER TABLE [Finance].[CashBoxAdjustment] ADD SourceCode NVARCHAR(60) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[Finance].[CashBoxAdjustment]') AND name = N'SourceCode' AND max_length < 120)
    ALTER TABLE [Finance].[CashBoxAdjustment] ALTER COLUMN SourceCode NVARCHAR(60) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[HR].[Employee]') AND name = N'CommissionRatePercent')
    ALTER TABLE [HR].[Employee] ADD CommissionRatePercent DECIMAL(5,2) NOT NULL CONSTRAINT DF_Employee_Commission DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Employee_Commission' AND parent_object_id = OBJECT_ID(N'[HR].[Employee]'))
    ALTER TABLE [HR].[Employee] ADD CONSTRAINT CK_Employee_Commission CHECK (CommissionRatePercent >= 0 AND CommissionRatePercent <= 100);
GO
