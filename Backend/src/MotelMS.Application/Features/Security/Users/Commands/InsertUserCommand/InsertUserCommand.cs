using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Contracts.Security;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Security.Users.Commands.InsertUserCommand;

public sealed record InsertUserCommand(
    Guid TenantId,
    Guid? LocationId,
    string Username,
    string Email,
    string FullName,
    string Role,
    string Password);

public sealed class InsertUserCommandValidator : AbstractValidator<InsertUserCommand>
{
    public InsertUserCommandValidator()
    {
        RuleFor(x => x.Username).NotEmpty().WithMessage("El nombre de usuario es obligatorio.")
            .MinimumLength(3).WithMessage("El nombre de usuario debe tener al menos 3 caracteres.")
            .MaximumLength(100).WithMessage("El nombre de usuario admite máximo 100 caracteres.")
            .Matches("^[a-zA-Z0-9._-]+$")
            .WithMessage("El nombre de usuario solo admite letras, números, punto, guion y guion bajo.");

        RuleFor(x => x.Email).NotEmpty().WithMessage("El correo es obligatorio.")
            .MaximumLength(150).WithMessage("El correo admite máximo 150 caracteres.")
            .EmailAddress().WithMessage("El correo no tiene un formato válido.");

        RuleFor(x => x.FullName).NotEmpty().WithMessage("El nombre completo es obligatorio.")
            .MaximumLength(150).WithMessage("El nombre completo admite máximo 150 caracteres.");

        RuleFor(x => x.Role).NotEmpty().WithMessage("El perfil es obligatorio.")
            .MaximumLength(50).WithMessage("El perfil admite máximo 50 caracteres.");

        RuleFor(x => x.Password).NotEmpty().WithMessage("La contraseña es obligatoria.")
            .MinimumLength(6).WithMessage("La contraseña debe tener al menos 6 caracteres.")
            .MaximumLength(100).WithMessage("La contraseña admite máximo 100 caracteres.");
    }
}

public sealed class InsertUserCommandHandler(ISqlConnector connector, IPasswordHashingService hasher)
{
    public async Task<Result<int>> HandleAsync(InsertUserCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@Username", command.Username.Trim());
        parameters.Add("@Email", command.Email.Trim());
        parameters.Add("@PasswordHash", hasher.Hash(command.Password));
        parameters.Add("@FullName", command.FullName.Trim());
        parameters.Add("@Role", command.Role.Trim());
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Security].[uspInsertUser]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
