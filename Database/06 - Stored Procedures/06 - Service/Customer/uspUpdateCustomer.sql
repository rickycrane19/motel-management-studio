/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspUpdateCustomer]
   SUBDOMAIN:   Customer
   DESCRIPTION: Actualiza la ficha de un cliente del tenant (nombre, documento, contacto y notas).

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Cliente inexistente)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspUpdateCustomer] (
    @TenantId       UNIQUEIDENTIFIER,
    @CustomerId     INT,
    @FullName       NVARCHAR(150),
    @DocumentNumber NVARCHAR(50)  = NULL,
    @Phone          NVARCHAR(50)  = NULL,
    @Email          NVARCHAR(150) = NULL,
    @Notes          NVARCHAR(300) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL OR @CustomerId IS NULL OR @CustomerId <= 0
        THROW 50400, N'El cliente no es válido.', 1;

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 50400, N'El nombre del cliente no puede estar vacío.', 1;

    UPDATE [Service].[Customer]
    SET FullName       = LTRIM(RTRIM(@FullName)),
        DocumentNumber = NULLIF(LTRIM(RTRIM(@DocumentNumber)), ''),
        Phone          = NULLIF(LTRIM(RTRIM(@Phone)), ''),
        Email          = NULLIF(LTRIM(RTRIM(@Email)), ''),
        Notes          = NULLIF(LTRIM(RTRIM(@Notes)), '')
    WHERE TenantId = @TenantId
      AND CustomerId = @CustomerId
      AND IsAnonymous = 0;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El cliente no existe en este motel.', 1;
END
GO
