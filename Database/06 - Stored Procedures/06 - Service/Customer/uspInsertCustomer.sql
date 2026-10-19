/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspInsertCustomer]
   SUBDOMAIN:   Customer
   DESCRIPTION: Registra un cliente con su documento, contacto y notas. El nombre es lo
                único obligatorio; el resto de la ficha es opcional.

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspInsertCustomer] (
    @TenantId       UNIQUEIDENTIFIER,
    @FullName       NVARCHAR(150),
    @DocumentNumber NVARCHAR(50)  = NULL,
    @Phone          NVARCHAR(50)  = NULL,
    @Email          NVARCHAR(150) = NULL,
    @Notes          NVARCHAR(300) = NULL,
    @InsertedId     INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 50400, N'El nombre del cliente no puede estar vacío.', 1;

    INSERT INTO [Service].[Customer]
    (
        TenantId,
        FullName,
        DocumentNumber,
        Phone,
        Email,
        Notes,
        IsAnonymous,
        IsActive,
        CreatedOn
    )
    VALUES
    (
        @TenantId,
        LTRIM(RTRIM(@FullName)),
        NULLIF(LTRIM(RTRIM(@DocumentNumber)), ''),
        NULLIF(LTRIM(RTRIM(@Phone)), ''),
        NULLIF(LTRIM(RTRIM(@Email)), ''),
        NULLIF(LTRIM(RTRIM(@Notes)), ''),
        0,
        1,
        SYSUTCDATETIME()
    );

    SET @InsertedId = SCOPE_IDENTITY();
END
GO
