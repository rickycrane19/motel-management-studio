/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetDenominations]
   SUBDOMAIN:   CashBoxDenomination
   DESCRIPTION: Lista las denominaciones (billetes y monedas) para Córdoba (NIO), Dólar (USD)
                y Colón (CRC) con la tasa de conversión actualizada a moneda base NIO.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetDenominations] (
    @TenantId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.DenominationId,
        d.CurrencyCode,
        c.Name AS CurrencyName,
        c.Symbol AS CurrencySymbol,
        d.[Value],
        d.Label,
        [Configuration].[fnGetExchangeRateValue](@TenantId, d.CurrencyCode, 'NIO') AS ExchangeRateToNIO
    FROM [Finance].[CashBoxDenomination] AS d
    INNER JOIN [Configuration].[Currency] AS c ON d.CurrencyCode = c.CurrencyCode
    WHERE d.IsActive = 1
    ORDER BY d.CurrencyCode, d.[Value] DESC;
END
GO
