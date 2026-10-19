/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspSetCustomerActive]
   SUBDOMAIN:   Customer
   DESCRIPTION: Activa o desactiva un cliente. Los clientes inactivos conservan su historial
                pero no aparecen por defecto en el listado.

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Cliente inexistente)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspSetCustomerActive] (
    @TenantId   UNIQUEIDENTIFIER,
    @CustomerId INT,
    @IsActive   BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL OR @CustomerId IS NULL OR @CustomerId <= 0
        THROW 50400, N'El cliente no es válido.', 1;

    UPDATE [Service].[Customer]
    SET IsActive = @IsActive
    WHERE TenantId = @TenantId
      AND CustomerId = @CustomerId
      AND IsAnonymous = 0;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El cliente no existe en este motel.', 1;
END
GO
