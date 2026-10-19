using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Customers.Commands.InsertCustomerCommand;

public sealed record InsertCustomerCommand(
    Guid TenantId,
    string FullName,
    string? DocumentNumber = null,
    string? Phone = null,
    string? Email = null,
    string? Notes = null);

public sealed class InsertCustomerCommandValidator : AbstractValidator<InsertCustomerCommand>
{
    public InsertCustomerCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("El nombre del cliente es obligatorio.")
            .MaximumLength(150).WithMessage("El nombre del cliente admite máximo 150 caracteres.");
        RuleFor(x => x.DocumentNumber).MaximumLength(50).WithMessage("El documento admite máximo 50 caracteres.");
        RuleFor(x => x.Phone).MaximumLength(50).WithMessage("El teléfono admite máximo 50 caracteres.");
        RuleFor(x => x.Email).MaximumLength(150).WithMessage("El correo admite máximo 150 caracteres.")
            .EmailAddress().WithMessage("El correo del cliente no tiene un formato válido.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Notes).MaximumLength(300).WithMessage("Las notas admiten máximo 300 caracteres.");
    }
}

public sealed class InsertCustomerCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertCustomerCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@FullName", command.FullName);
        parameters.Add("@DocumentNumber", command.DocumentNumber);
        parameters.Add("@Phone", command.Phone);
        parameters.Add("@Email", command.Email);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspInsertCustomer]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
