/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]  ·  Migración incremental (idempotente)

   Cambio: la ficha de cliente deja de guardar solo el nombre. Agrega documento,
           teléfono, correo, notas y estado para el módulo de clientes del back office.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

IF COL_LENGTH('Service.Customer', 'DocumentNumber') IS NULL
    ALTER TABLE [Service].[Customer] ADD DocumentNumber NVARCHAR(50) NULL;
GO

IF COL_LENGTH('Service.Customer', 'Phone') IS NULL
    ALTER TABLE [Service].[Customer] ADD Phone NVARCHAR(50) NULL;
GO

IF COL_LENGTH('Service.Customer', 'Email') IS NULL
    ALTER TABLE [Service].[Customer] ADD Email NVARCHAR(150) NULL;
GO

IF COL_LENGTH('Service.Customer', 'Notes') IS NULL
    ALTER TABLE [Service].[Customer] ADD Notes NVARCHAR(300) NULL;
GO

IF COL_LENGTH('Service.Customer', 'IsActive') IS NULL
    ALTER TABLE [Service].[Customer]
        ADD IsActive BIT NOT NULL CONSTRAINT DF_Customer_IsActive DEFAULT 1;
GO
