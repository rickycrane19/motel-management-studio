using Microsoft.Data.SqlClient;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Common.Data;

public static class QueryRunner
{
    public static async Task<Result<IEnumerable<T>>> QueryAsync<T>(
        ISqlConnector connector,
        string procedureName,
        object? parameters = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var data = await connector.QueryAsync<T>(procedureName, parameters, cancellationToken).ConfigureAwait(false);
            return Result<IEnumerable<T>>.Success(data);
        }
        catch (SqlException ex)
        {
            return ex.MapToResult<IEnumerable<T>>();
        }
    }

    public static async Task<Result<T?>> QuerySingleOrDefaultAsync<T>(
        ISqlConnector connector,
        string procedureName,
        object? parameters = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var data = await connector.QuerySingleOrDefaultAsync<T>(procedureName, parameters, cancellationToken).ConfigureAwait(false);
            return Result<T?>.Success(data);
        }
        catch (SqlException ex)
        {
            return ex.MapToResult<T?>();
        }
    }
}
