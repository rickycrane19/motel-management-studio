namespace MotelMS.Application.Contracts.Security;

/// <summary>
/// Contrato para el hash y verificación de contraseñas de usuarios.
/// </summary>
public interface IPasswordHashingService
{
    /// <summary>Genera un hash seguro (PBKDF2) para la contraseña indicada.</summary>
    string Hash(string password);

    /// <summary>Verifica una contraseña en texto plano contra un hash almacenado.</summary>
    bool Verify(string password, string storedHash);
}
