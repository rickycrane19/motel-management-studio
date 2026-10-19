USE [MotelMSDB];
GO

IF OBJECT_ID(N'Security.UserSession', 'U') IS NOT NULL DROP TABLE [Security].[UserSession];
IF OBJECT_ID(N'Security.User', 'U') IS NOT NULL DROP TABLE [Security].[User];
GO

CREATE TABLE [Security].[User]
(
    UserId          INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    Username        NVARCHAR(50)      NOT NULL,
    Email           NVARCHAR(150)     NOT NULL,
    PasswordHash    NVARCHAR(256)     NOT NULL,
    FullName        NVARCHAR(150)     NOT NULL,
    Role            NVARCHAR(50)      NOT NULL CONSTRAINT DF_User_Role DEFAULT 'Receptionist',
    IsActive        BIT               NOT NULL CONSTRAINT DF_User_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_User_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_User PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT FK_User_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_User_Location FOREIGN KEY (LocationId) REFERENCES [Tenant].[TenantLocations](LocationId),
    CONSTRAINT UQ_User_TenantUsername UNIQUE (TenantId, Username)
);
GO

CREATE TABLE [Security].[UserSession]
(
    SessionId       UNIQUEIDENTIFIER  NOT NULL CONSTRAINT DF_UserSession_SessionId DEFAULT NEWID(),
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    UserId          INT               NOT NULL,
    StartedAt       DATETIME2         NOT NULL CONSTRAINT DF_UserSession_StartedAt DEFAULT SYSUTCDATETIME(),
    EndedAt         DATETIME2         NULL,
    IpAddress       NVARCHAR(50)      NULL,
    IsActive        BIT               NOT NULL CONSTRAINT DF_UserSession_IsActive DEFAULT 1,

    CONSTRAINT PK_UserSession PRIMARY KEY CLUSTERED (SessionId),
    CONSTRAINT FK_UserSession_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_UserSession_User FOREIGN KEY (UserId) REFERENCES [Security].[User](UserId)
);
GO
