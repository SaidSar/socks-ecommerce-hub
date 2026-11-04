using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Sokko.Api.Services;

public static class ContactLimits
{
    public const string Policy = "contact";
    private const int DefaultPermitLimit = 5;

    /// <summary>
    /// 5 mensajes por IP por hora (<c>RateLimiting:ContactPermitLimit</c>). El 429 con ProblemDetails y Retry-After lo arma el
    /// <c>OnRejected</c> común de <see cref="AuthLimits"/>.
    /// </summary>
    public static IServiceCollection AddContactRateLimiting(this IServiceCollection services) =>
        services.Configure<RateLimiterOptions>(options =>
            options.AddPolicy(Policy, context =>
            {
                var limit = context.RequestServices.GetRequiredService<IConfiguration>().GetValue("RateLimiting:ContactPermitLimit", DefaultPermitLimit);
                return RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "", _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = limit,
                    Window = TimeSpan.FromHours(1),
                    QueueLimit = 0,
                });
            }));
}
