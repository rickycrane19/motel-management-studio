using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Commands.ExtendRoomStayCommand;

public sealed record ExtendRoomStayCommand(
    Guid TenantId,
    int RoomStayId,
    int ServiceStayTypeId,
    int? CreatedBy = null);

public sealed class ExtendRoomStayCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(ExtendRoomStayCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@RoomStayId", command.RoomStayId);
        parameters.Add("@ServiceStayTypeId", command.ServiceStayTypeId);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspExtendRoomStay]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
