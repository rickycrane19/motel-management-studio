using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Contracts.Security;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Security.Auth.Commands.LoginCommand;

public sealed record LoginCommand(string Username, string Password);

public sealed record AuthenticatedUserDto
{
    public int UserId { get; init; }
    public Guid TenantId { get; init; }
    public string TenantName { get; init; } = string.Empty;
    public Guid? LocationId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public string TimeZone { get; init; } = string.Empty;
    public string CurrencyCode { get; init; } = string.Empty;
}

public sealed record LoginResultDto
{
    public string AccessToken { get; init; } = string.Empty;
    public DateTime ExpiresAtUtc { get; init; }
    public AuthenticatedUserDto User { get; init; } = new();
}

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Username).NotEmpty().WithMessage("El usuario es obligatorio.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("La contraseña es obligatoria.");
    }
}

/// <summary>Fila retornada por [Security].[uspGetUserByUsername].</summary>
internal sealed class UserCredentialRow
{
    public int UserId { get; init; }
    public Guid TenantId { get; init; }
    public string? TenantName { get; init; }
    public string? TimeZone { get; init; }
    public string? CurrencyCode { get; init; }
    public Guid? LocationId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PasswordHash { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}

public sealed class LoginCommandHandler(
    ISqlConnector connector,
    IPasswordHashingService passwordHasher,
    ITokenProvider tokenProvider)
{
    private static readonly Error InvalidCredentials =
        Error.Unauthorized("Usuario o contraseña incorrectos.", "Auth.InvalidCredentials");

    public async Task<Result<LoginResultDto>> HandleAsync(LoginCommand command, CancellationToken cancellationToken = default)
    {
        var credentialResult = await QueryRunner.QuerySingleOrDefaultAsync<UserCredentialRow>(
            connector,
            "[Security].[uspGetUserByUsername]",
            new { Username = command.Username.Trim() },
            cancellationToken);

        if (credentialResult.IsFailure)
            return Result<LoginResultDto>.Failure(credentialResult.Error!);

        var row = credentialResult.Value;
        if (row is null || !passwordHasher.Verify(command.Password, row.PasswordHash))
            return Result<LoginResultDto>.Failure(InvalidCredentials);

        var timeZone = string.IsNullOrWhiteSpace(row.TimeZone) ? "America/Managua" : row.TimeZone!;
        var token = tokenProvider.CreateToken(
            row.UserId,
            row.TenantId,
            row.LocationId,
            row.Username,
            row.FullName,
            row.Role,
            timeZone);

        return Result<LoginResultDto>.Success(new LoginResultDto
        {
            AccessToken = token.AccessToken,
            ExpiresAtUtc = token.ExpiresAtUtc,
            User = new AuthenticatedUserDto
            {
                UserId = row.UserId,
                TenantId = row.TenantId,
                TenantName = row.TenantName ?? string.Empty,
                LocationId = row.LocationId,
                Username = row.Username,
                Email = row.Email,
                FullName = row.FullName,
                Role = row.Role,
                TimeZone = timeZone,
                CurrencyCode = string.IsNullOrWhiteSpace(row.CurrencyCode) ? "NIO" : row.CurrencyCode!
            }
        });
    }
}
