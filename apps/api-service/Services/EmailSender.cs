namespace Sokko.Api.Services;

/// <summary>Servicio de utilidad: envío de correos.</summary>
public interface IEmailSender
{
    Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default);

    Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default);
}

/// <summary>Development: el enlace solo se escribe en el log.</summary>
public class LogEmailSender(ILogger<LogEmailSender> logger) : IEmailSender
{
    public Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Restablecimiento de contraseña para {Email}: {Link}", email, link);
        return Task.CompletedTask;
    }

    public Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Invitación al panel para {Email}: {Link}", email, link);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Fuera de Development todavía no hay proveedor de correo: el enlace nunca se escribe en el log, porque da acceso a la cuenta.
/// </summary>
public class UnconfiguredEmailSender(ILogger<UnconfiguredEmailSender> logger) : IEmailSender
{
    public Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default)
    {
        logger.LogError("No hay proveedor de correo configurado: no se envió un enlace de restablecimiento.");
        return Task.CompletedTask;
    }

    public Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default)
    {
        logger.LogError("No hay proveedor de correo configurado: no se envió una invitación.");
        return Task.CompletedTask;
    }
}
