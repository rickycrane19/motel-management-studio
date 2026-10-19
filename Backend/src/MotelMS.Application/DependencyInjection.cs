using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace MotelMS.Application;

/// <summary>
/// Registro de dependencias de la capa de aplicación: validadores FluentValidation
/// y todos los handlers de los vertical slices (Features/*).
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddValidatorsFromAssembly(assembly);

        // Registra cada handler concreto (clases terminadas en "Handler") como scoped self.
        var handlerTypes = assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false, IsNested: false }
                        && t.Namespace is not null
                        && t.Namespace.StartsWith("MotelMS.Application.Features", StringComparison.Ordinal)
                        && t.Name.EndsWith("Handler", StringComparison.Ordinal));

        foreach (var handlerType in handlerTypes)
            services.AddScoped(handlerType);

        return services;
    }
}
