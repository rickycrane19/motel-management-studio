USE [MotelMSDB];
GO

IF OBJECT_ID(N'Configuration.ExchangeRate', 'U') IS NOT NULL DROP TABLE [Configuration].[ExchangeRate];
IF OBJECT_ID(N'Configuration.Currency', 'U') IS NOT NULL DROP TABLE [Configuration].[Currency];
GO

CREATE TABLE [Configuration].[Currency]
(
    CurrencyCode           CHAR(3)          NOT NULL,
    Name                   NVARCHAR(50)     NOT NULL,
    Symbol                 NVARCHAR(10)     NOT NULL,
    ExchangeRateToDefault  DECIMAL(18, 8)   NOT NULL CONSTRAINT DF_Currency_Rate DEFAULT 1.0,
    IsBase                 BIT              NOT NULL CONSTRAINT DF_Currency_IsBase DEFAULT 0,
    IsActive               BIT              NOT NULL CONSTRAINT DF_Currency_IsActive DEFAULT 1,

    CONSTRAINT PK_Currency PRIMARY KEY CLUSTERED (CurrencyCode)
);
GO

CREATE TABLE [Configuration].[ExchangeRate]
(
    ExchangeRateId         INT IDENTITY(1,1) NOT NULL,
    TenantId               UNIQUEIDENTIFIER  NOT NULL,
    FromCurrencyCode       CHAR(3)           NOT NULL,
    ToCurrencyCode         CHAR(3)           NOT NULL,
    ExchangeRateValue      DECIMAL(18, 8)    NOT NULL,
    ExchangeRateDate       DATETIME2         NOT NULL CONSTRAINT DF_ExchangeRate_Date DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_ExchangeRate PRIMARY KEY CLUSTERED (ExchangeRateId),
    CONSTRAINT FK_ExchangeRate_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_ExchangeRate_FromCurrency FOREIGN KEY (FromCurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode),
    CONSTRAINT FK_ExchangeRate_ToCurrency FOREIGN KEY (ToCurrencyCode) REFERENCES [Configuration].[Currency](CurrencyCode)
);
GO
