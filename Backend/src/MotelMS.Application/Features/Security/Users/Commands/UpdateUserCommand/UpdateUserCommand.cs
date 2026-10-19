using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Contracts.Security;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Security.Users.Commands.UpdateUserCommand;

public sealed record UpdateUserCommand(
    Guid TenantId,
    int UserId,
    string Username,
    string Email,
    string FullName,
    string Role,
    string? Password = null);

public sealed class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0).WithMessage("El usuario no es válido.");

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

        RuleFor(x => x.Password).MinimumLength(6).WithMessage("La contraseña debe tener al menos 6 caracteres.")
            .MaximumLength(100).WithMessage("La contraseña admite máximo 100 caracteres.")
            .When(x => !string.IsNullOrWhiteSpace(x.Password));
    }
}

public sealed class UpdateUserCommandHandler(ISqlConnector connector, IPasswordHashingService hasher)
{
    public async Task<Result> HandleAsync(UpdateUserCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Security].[uspUpdateUser]",
            new
            {
                command.TenantId,
                command.UserId,
                Username = command.Username.Trim(),
                Email = command.Email.Trim(),
                FullName = command.FullName.Trim(),
                Role = command.Role.Trim(),
                PasswordHash = string.IsNullOrWhiteSpace(command.Password) ? null : hasher.Hash(command.Password)
            },
            cancellationToken);
    }
}
