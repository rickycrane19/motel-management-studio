USE [MotelMSDB];
GO

IF OBJECT_ID(N'Configuration.fnGetExchangeRateValue', 'FN') IS NOT NULL
    DROP FUNCTION [Configuration].[fnGetExchangeRateValue];
GO

CREATE FUNCTION [Configuration].[fnGetExchangeRateValue]
(
    @TenantId         UNIQUEIDENTIFIER,
    @FromCurrencyCode CHAR(3),
    @ToCurrencyCode   CHAR(3)
)
RETURNS DECIMAL(18, 8)
AS
BEGIN
    IF @FromCurrencyCode = @ToCurrencyCode
        RETURN 1.0;

    DECLARE @Rate DECIMAL(18, 8);

    SELECT TOP 1 @Rate = ExchangeRateValue
    FROM [Configuration].[ExchangeRate]
    WHERE TenantId = @TenantId
      AND FromCurrencyCode = @FromCurrencyCode
      AND ToCurrencyCode = @ToCurrencyCode
    ORDER BY ExchangeRateDate DESC;

    -- Si no hay tasa directa, buscar inversa
    IF @Rate IS NULL
    BEGIN
        SELECT TOP 1 @Rate = 1.0 / NULLIF(ExchangeRateValue, 0)
        FROM [Configuration].[ExchangeRate]
        WHERE TenantId = @TenantId
          AND FromCurrencyCode = @ToCurrencyCode
          AND ToCurrencyCode = @FromCurrencyCode
        ORDER BY ExchangeRateDate DESC;
    END

    RETURN ISNULL(@Rate, 1.0);
END
GO

IF OBJECT_ID(N'Configuration.fnToManaguaTime', 'FN') IS NOT NULL
    DROP FUNCTION [Configuration].[fnToManaguaTime];
GO

CREATE FUNCTION [Configuration].[fnToManaguaTime]
(
    @UtcDateTime DATETIME2
)
RETURNS DATETIME2
AS
BEGIN
    IF @UtcDateTime IS NULL
        RETURN NULL;

    RETURN CAST(@UtcDateTime AT TIME ZONE 'UTC' AT TIME ZONE 'Central America Standard Time' AS DATETIME2);
END
GO
