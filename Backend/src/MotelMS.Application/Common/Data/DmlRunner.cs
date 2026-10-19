using System.Data;
using System.Globalization;
using Dapper;
using Microsoft.Data.SqlClient;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Common.Data;

public static class DmlRunner
{
    public static async Task<Result> ExecuteAsync(
        ISqlConnector connector,
        string procedureName,
        object? parameters = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await connector.ExecuteAsync(procedureName, parameters, cancellationToken).ConfigureAwait(false);
            return Result.Success();
        }
        catch (SqlException ex)
        {
            return ex.MapToResult();
        }
    }

    public static async Task<Result<int>> ExecuteReturningIdAsync(
        ISqlConnector connector,
        string procedureName,
        DynamicParameters parameters,
        string idParameterName = "@InsertedId",
        CancellationToken cancellationToken = default)
    {
        try
        {
            await connector.ExecuteAsync(procedureName, parameters, cancellationToken).ConfigureAwait(false);
            var raw = parameters.Get<object>(idParameterName);
            var id = raw is DBNull or null ? 0 : Convert.ToInt32(raw, CultureInfo.InvariantCulture);
            return Result<int>.Success(id);
        }
        catch (SqlException ex)
        {
            return ex.MapToResult<int>();
        }
    }

    public static async Task<Result<T>> ExecuteScalarAsync<T>(
        ISqlConnector connector,
        string procedureName,
        object? parameters = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var raw = await connector.ExecuteScalarAsync<T>(procedureName, parameters, cancellationToken).ConfigureAwait(false);
            return Result<T>.Success(raw!);
        }
        catch (SqlException ex)
        {
            return ex.MapToResult<T>();
        }
    }
}
