namespace MotelMS.Infrastructure.Configuration.Options;

/// <summary>Configuración de emisión/validación de tokens JWT.</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "MotelMS";
    public string Audience { get; set; } = "MotelMS.Client";
    public int ExpiryMinutes { get; set; } = 720;
}
