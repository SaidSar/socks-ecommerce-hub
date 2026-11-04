using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

/// <summary>Mensaje ya validado por <c>ContactRequestDto</c>. <c>Website</c> es el honeypot.</summary>
public record NewContactMessage(string Name, string Email, string Subject, string Message, string? Website, string? IpAddress);

/// <summary>Servicio de tarea: recibe un mensaje del formulario de contacto, lo guarda y avisa a la tienda.</summary>
public interface ISubmitContactMessage
{
    /// <summary>
    /// <c>null</c> si el honeypot venía lleno (no se guarda nada, pero la respuesta es la misma para no delatar el filtro).
    /// Si el correo falla, el mensaje queda guardado con <c>NotifiedAt = null</c>.
    /// </summary>
    Task<ContactMessage?> SubmitAsync(NewContactMessage message, CancellationToken cancellationToken = default);
}

public class SubmitContactMessage(SokkoDbContext db, IEmailSender email, IClock clock, ILogger<SubmitContactMessage> logger) : ISubmitContactMessage
{
    public async Task<ContactMessage?> SubmitAsync(NewContactMessage message, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(message.Website))
        {
            logger.LogInformation("Mensaje de contacto descartado por el honeypot desde {Ip}", message.IpAddress);
            return null;
        }

        var saved = new ContactMessage
        {
            Name = message.Name.Trim(),
            Email = message.Email.Trim().ToLowerInvariant(),
            // El asunto va en el encabezado del correo: sin saltos de línea.
            Subject = message.Subject.Trim().ReplaceLineEndings(" "),
            Message = message.Message.Trim(),
            IpAddress = message.IpAddress,
            CreatedAt = clock.UtcNow,
        };
        db.ContactMessages.Add(saved);
        await db.SaveChangesAsync(cancellationToken);

        var to = await db.Settings.AsNoTracking().Select(s => s.ContactEmail).SingleOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(to))
        {
            return saved;
        }

        try
        {
            await email.SendContactNotificationAsync(new ContactNotificationEmail(to, saved.Name, saved.Email, saved.Subject, saved.Message), cancellationToken);
            saved.NotifiedAt = clock.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // El mensaje ya está guardado: el equipo lo ve aunque el correo no salga.
            logger.LogError(ex, "No se pudo avisar por correo del mensaje de contacto {Id}", saved.Id);
        }
        return saved;
    }
}
