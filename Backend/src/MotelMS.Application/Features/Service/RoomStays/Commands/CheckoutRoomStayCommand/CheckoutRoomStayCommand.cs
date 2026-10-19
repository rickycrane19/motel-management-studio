using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Commands.CheckoutRoomStayCommand;

public sealed record CheckoutRoomStayCommand(
    Guid TenantId,
    int RoomStayId,
    decimal PaidAmount,
    string PaymentMethod,
    int? CashBoxSessionId = null,
    int? UserId = null);

public sealed class CheckoutRoomStayCommandValidator : AbstractValidator<CheckoutRoomStayCommand>
{
    public CheckoutRoomStayCommandValidator()
    {
        RuleFor(x => x.RoomStayId).GreaterThan(0);
        RuleFor(x => x.PaidAmount).GreaterThan(0).WithMessage("El monto pagado debe ser mayor a 0.");
        RuleFor(x => x.PaymentMethod).NotEmpty().WithMessage("El método de pago es obligatorio.");
    }
}

public sealed class CheckoutRoomStayCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(CheckoutRoomStayCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspCheckoutRoomStay]",
            new
            {
                command.TenantId,
                command.RoomStayId,
                command.PaidAmount,
                command.PaymentMethod,
                command.CashBoxSessionId,
                command.UserId
            },
            cancellationToken);
    }
}
