using Azure;
using Azure.Communication.Email;

namespace Sokko.Api.Services;

/// <summary>Línea del correo de confirmación.</summary>
public record OrderEmailLine(string Name, string Tone, string Size, int Quantity, decimal LineTotal);

/// <summary>Datos del correo de confirmación de pedido. <c>OxxoExpiresAt</c> solo viene si falta pagar en OXXO.</summary>
public record OrderConfirmationEmail(
    string Email,
    string FirstName,
    string Folio,
    decimal Total,
    string? OxxoReference,
    DateTime? OxxoExpiresAt,
    IReadOnlyList<OrderEmailLine> Lines);

/// <summary>Servicio de utilidad: envío de correos.</summary>
public interface IEmailSender
{
    Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default);

    Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default);

    Task SendOrderConfirmationAsync(OrderConfirmationEmail order, CancellationToken cancellationToken = default);
}

/// <summary>Development: el correo solo se escribe en el log. Lleva enlaces que dan acceso a la cuenta: nunca se usa en producción.</summary>
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

    public Task SendOrderConfirmationAsync(OrderConfirmationEmail order, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Confirmación del pedido {Folio} para {Email}", order.Folio, order.Email);
        return Task.CompletedTask;
    }
}

/// <summary>Producción: Azure Communication Services. No espera a que el correo se entregue, solo a que el servicio lo acepte.</summary>
public class AzureCommunicationEmailSender(EmailClient client, string senderAddress) : IEmailSender
{
    public Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default) =>
        SendAsync(email, EmailTemplates.PasswordReset(link), cancellationToken);

    public Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default) =>
        SendAsync(email, EmailTemplates.Invitation(link), cancellationToken);

    public Task SendOrderConfirmationAsync(OrderConfirmationEmail order, CancellationToken cancellationToken = default) =>
        SendAsync(order.Email, EmailTemplates.OrderConfirmation(order), cancellationToken);

    private Task SendAsync(string to, EmailContentParts parts, CancellationToken cancellationToken) =>
        client.SendAsync(
            WaitUntil.Started,
            new EmailMessage(senderAddress, to, new EmailContent(parts.Subject) { Html = parts.Html, PlainText = parts.Text }),
            cancellationToken);
}

public static class EmailSetup
{
    public const string LogProvider = "Log";
    public const string AzureProvider = "Azure";

    /// <summary>
    /// Elige con <c>Email:Provider</c>; en Development, Log por omisión. Se resuelve al arrancar la app y no al armarla, porque el
    /// bundle de migraciones arma la app sin estos ajustes. Fuera de Development no hay Log: escribiría enlaces de acceso.
    /// </summary>
    public static IEmailSender Create(IServiceProvider services, IConfiguration configuration, bool isDevelopment)
    {
        var provider = configuration["Email:Provider"] ?? (isDevelopment ? LogProvider : null);
        switch (provider)
        {
            case LogProvider when isDevelopment:
                return ActivatorUtilities.CreateInstance<LogEmailSender>(services);
            case AzureProvider:
                var connectionString = configuration["Email:ConnectionString"];
                var sender = configuration["Email:SenderAddress"];
                if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(sender))
                {
                    throw new InvalidOperationException("Faltan Email:ConnectionString o Email:SenderAddress.");
                }
                return new AzureCommunicationEmailSender(new EmailClient(connectionString), sender);
            default:
                throw new InvalidOperationException($"Email:Provider no es válido en este ambiente: '{provider}'.");
        }
    }
}
