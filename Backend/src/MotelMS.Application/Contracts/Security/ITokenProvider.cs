namespace MotelMS.Application.Contracts.Security;

/// <summary>Resultado de la emisión de un token de acceso JWT.</summary>
public sealed record TokenResult(string AccessToken, DateTime ExpiresAtUtc);

/// <summary>
/// Contrato para la emisión de tokens de acceso JWT con el scope multi-tenant
/// (tenant, sucursal y rol del usuario).
/// </summary>
public interface ITokenProvider
{
    TokenResult CreateToken(
        int userId,
        Guid tenantId,
        Guid? locationId,
        string username,
        string fullName,
        string role,
        string timeZone);
}
