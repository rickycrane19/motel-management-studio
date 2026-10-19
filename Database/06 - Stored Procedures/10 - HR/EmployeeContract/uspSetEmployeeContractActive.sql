/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspSetEmployeeContractActive]
   SUBDOMAIN:   EmployeeContract
   DESCRIPTION: Termina o reabre un contrato sin borrarlo; queda en el historial para los
                reportes de nómina y de egresos de caja.

   ──────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Contrato no existe)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspSetEmployeeContractActive] (
    @TenantId   UNIQUEIDENTIFIER,
    @ContractId INT,
    @IsActive   BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ContractId IS NULL OR @ContractId <= 0
        THROW 50400, N'El ContractId es obligatorio.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado del contrato.', 1;

    UPDATE [HR].[EmployeeContract]
    SET IsActive = @IsActive
    WHERE ContractId = @ContractId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El contrato indicado no existe.', 1;
END
GO
