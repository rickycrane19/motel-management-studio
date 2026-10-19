using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Contracts.Security;
using MotelMS.Application.Contracts.Time;
using MotelMS.Infrastructure.Configuration;
using MotelMS.Infrastructure.Configuration.Options;
using MotelMS.Infrastructure.Data;
using MotelMS.Infrastructure.Security;
using MotelMS.Infrastructure.Time;

namespace MotelMS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        Microsoft.Extensions.Configuration.IConfiguration configuration)
    {
        // Opciones (JWT)
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        // Contexto HTTP y tiempo (zona horaria Managua)
        services.AddHttpContextAccessor();
        services.AddSingleton<IDateTimeProvider, NicaraguaDateTimeProvider>();

        // Acceso a datos (Dapper + Stored Procedures)
        services.AddScoped<ISqlConnectionFactory, SqlConnectionFactory>();
        services.AddScoped<ISqlConnector, SqlServerConnector>();

        // Seguridad
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IPasswordHashingService, PasswordHasher>();
        services.AddSingleton<ITokenProvider, JwtProvider>();

        return services;
    }
}
