USE [MotelMSDB];
GO

IF OBJECT_ID(N'Tenant.TenantLocations', 'U') IS NOT NULL DROP TABLE [Tenant].[TenantLocations];
IF OBJECT_ID(N'Tenant.Tenants', 'U') IS NOT NULL DROP TABLE [Tenant].[Tenants];
GO

CREATE TABLE [Tenant].[Tenants]
(
    TenantId        UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Tenants_TenantId DEFAULT NEWID(),
    Name            NVARCHAR(150)    NOT NULL,
    LegalName       NVARCHAR(200)    NULL,
    Phone           NVARCHAR(50)     NULL,
    Email           NVARCHAR(150)    NULL,
    Address         NVARCHAR(250)    NULL,
    TimeZone        NVARCHAR(50)     NOT NULL CONSTRAINT DF_Tenants_TimeZone DEFAULT 'America/Managua',
    CurrencyCode    CHAR(3)          NOT NULL CONSTRAINT DF_Tenants_CurrencyCode DEFAULT 'NIO',
    IsActive        BIT              NOT NULL CONSTRAINT DF_Tenants_IsActive DEFAULT 1,
    CreatedOn       DATETIME2        NOT NULL CONSTRAINT DF_Tenants_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Tenants PRIMARY KEY CLUSTERED (TenantId)
);
GO

CREATE TABLE [Tenant].[TenantLocations]
(
    LocationId      UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_TenantLocations_LocationId DEFAULT NEWID(),
    TenantId        UNIQUEIDENTIFIER NOT NULL,
    Name            NVARCHAR(150)    NOT NULL,
    Address         NVARCHAR(250)    NULL,
    Phone           NVARCHAR(50)     NULL,
    IsActive        BIT              NOT NULL CONSTRAINT DF_TenantLocations_IsActive DEFAULT 1,
    CreatedOn       DATETIME2        NOT NULL CONSTRAINT DF_TenantLocations_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_TenantLocations PRIMARY KEY CLUSTERED (LocationId),
    CONSTRAINT FK_TenantLocations_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId)
);
GO
