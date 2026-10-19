using System.Security.Cryptography;
using System.Text;
using MotelMS.Application.Contracts.Security;

namespace MotelMS.Infrastructure.Security;

/// <summary>
/// Servicio de hash de contraseñas basado en PBKDF2 (HMAC-SHA256, 100k iteraciones).
/// Formato almacenado: pbkdf2$iteraciones$saltBase64$hashBase64
/// Compatibilidad: si el hash almacenado no tiene el prefijo pbkdf2$, se interpreta
/// como SHA-256 en hexadecimal (formato heredado usado por la data semilla).
/// </summary>
public sealed class PasswordHasher : IPasswordHashingService
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const string Prefix = "pbkdf2";

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, Iterations, HashAlgorithmName.SHA256, HashSize);

        return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string storedHash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(storedHash))
            return false;

        if (!storedHash.StartsWith($"{Prefix}$", StringComparison.Ordinal))
            return VerifyLegacySha256(password, storedHash);

        var parts = storedHash.Split('$');
        if (parts.Length != 4 || !int.TryParse(parts[1], out var iterations))
            return false;

        try
        {
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password), salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool VerifyLegacySha256(string password, string storedHash)
    {
        var computed = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(computed),
            Encoding.ASCII.GetBytes(storedHash.Trim().ToLowerInvariant()));
    }
}
