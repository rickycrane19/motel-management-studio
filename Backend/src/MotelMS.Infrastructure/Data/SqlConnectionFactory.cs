using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using MotelMS.Application.Contracts.Data;
using MotelMS.Infrastructure.Configuration;

namespace MotelMS.Infrastructure.Data;

public sealed class SqlConnectionFactory(IConfiguration configuration) : ISqlConnectionFactory
{
    private readonly string _connectionString = configuration.GetConnectionString(DatabaseConstants.ConnectionStringName)
        ?? "Server=(localdb)\\mssqllocaldb;Database=MotelMSDB;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
