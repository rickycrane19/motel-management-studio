USE [MotelMSDB];
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Tenant')
    EXEC('CREATE SCHEMA [Tenant]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Security')
    EXEC('CREATE SCHEMA [Security]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Configuration')
    EXEC('CREATE SCHEMA [Configuration]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Inventory')
    EXEC('CREATE SCHEMA [Inventory]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Service')
    EXEC('CREATE SCHEMA [Service]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'Finance')
    EXEC('CREATE SCHEMA [Finance]');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'HR')
    EXEC('CREATE SCHEMA [HR]');
GO
