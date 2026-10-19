using System.Data;

namespace MotelMS.Application.Contracts.Data;

public interface ISqlConnectionFactory
{
    IDbConnection CreateConnection();
}
