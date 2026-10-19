using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MotelMS.Application.Contracts.Security;
using MotelMS.Infrastructure.Configuration.Options;

namespace MotelMS.Infrastructure.Security;

/// <summary>Emisor de tokens JWT (HS256) con el scope multi-tenant del motel.</summary>
public sealed class JwtProvider(IOptions<JwtOptions> options) : ITokenProvider
{
    private readonly JwtOptions _options = options.Value;

    public TokenResult CreateToken(
        int userId,
        Guid tenantId,
        Guid? locationId,
        string username,
        string fullName,
        string role,
        string timeZone)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Name, username),
            new("uid", userId.ToString()),
            new(ClaimTypes.Role, role),
            new("role", role),
            new("full_name", fullName),
            new("tenant_id", tenantId.ToString()),
            new("timezone", timeZone)
        };

        if (locationId is not null)
            claims.Add(new Claim("location_id", locationId.Value.ToString()));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: credentials);

        return new TokenResult(new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
