using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

public static class AuthLimits
{
    public const string Policy = "auth";
    public const string InvalidCredentials = "El correo o la contraseña no coinciden.";
    private const int DefaultPermitLimit = 10;

    /// <summary>Límite por IP y ruta, para que agotar uno no bloquee los demás.</summary>
    public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(Policy, context =>
            {
                var limit = context.RequestServices.GetRequiredService<IConfiguration>().GetValue("RateLimiting:AuthPermitLimit", DefaultPermitLimit);
                var key = $"{context.Connection.RemoteIpAddress}|{context.Request.Path}";
                return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = limit,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
            });
            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                }
                await context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Demasiados intentos. Espere un momento e inténtelo de nuevo.",
                    },
                });
            };
        });
}

public static class AuthSetup
{
    /// <summary>JWT Bearer y una política por cada permiso del panel (DESIGN_ADMIN §3).</summary>
    public static IServiceCollection AddSokkoAuth(this IServiceCollection services)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>>(provider => new ConfigureNamedOptions<JwtBearerOptions>(
            JwtBearerDefaults.AuthenticationScheme,
            options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = provider.GetRequiredService<JwtOptions>().ValidationParameters();
            }));

        services.AddAuthorization(options =>
        {
            var staff = new[] { nameof(UserRole.Owner), nameof(UserRole.Operations) };
            options.AddPolicy(Permissions.Staff, policy => policy.RequireRole(staff));
            foreach (var permission in Permissions.All)
            {
                options.AddPolicy(permission, policy => policy.RequireRole(Permissions.OperationsCan(permission) ? staff : [nameof(UserRole.Owner)]));
            }
        });
        return services;
    }
}
