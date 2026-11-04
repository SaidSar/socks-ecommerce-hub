using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

/// <summary>Cambio de estado de un mensaje en la bandeja.</summary>
public enum InboxAction
{
    Read,
    Unread,
    Archive,
    Unarchive,
}

/// <summary>Servicio de entidad: bandeja de mensajes de contacto (Dueño y Operaciones, messages.view).</summary>
public interface IContactInboxService
{
    /// <summary><c>status</c>: nuevos, leidos o archivados. <c>null</c> si el filtro no existe.</summary>
    Task<AdminMessageListDto?> ListAsync(string? status, string? q, int page, CancellationToken cancellationToken = default);

    /// <summary>Nuevos sin archivar: el número de la barra lateral.</summary>
    Task<int> UnreadCountAsync(CancellationToken cancellationToken = default);

    /// <summary>Idempotente: si ya estaba así no cambia nada, ni la fecha ni quién lo hizo.</summary>
    Task<AdminResult<AdminMessageDto>> ApplyAsync(int id, InboxAction action, StaffActor actor, CancellationToken cancellationToken = default);
}

public class ContactInboxService(SokkoDbContext db, IClock clock) : IContactInboxService
{
    public const int PageSize = 25;
    public const string NotFoundMessage = "No encontramos ese mensaje.";

    public static readonly string[] Statuses = ["nuevos", "leidos", "archivados"];

    private static IQueryable<ContactMessage> InStatus(IQueryable<ContactMessage> messages, string status) => status switch
    {
        "nuevos" => messages.Where(m => m.ArchivedAt == null && m.ReadAt == null),
        "leidos" => messages.Where(m => m.ArchivedAt == null && m.ReadAt != null),
        _ => messages.Where(m => m.ArchivedAt != null),
    };

    private static AdminMessageDto ToDto(ContactMessage m) => new(
        m.Id, m.Name, m.Email, m.Subject, m.Message, m.CreatedAt, m.ReadAt, m.ArchivedAt, m.HandledBy is { } u ? StaffActor.From(u).Name : null);

    public async Task<AdminMessageListDto?> ListAsync(string? status, string? q, int page, CancellationToken cancellationToken = default)
    {
        var key = string.IsNullOrEmpty(status) ? "nuevos" : status;
        if (!Statuses.Contains(key))
        {
            return null;
        }

        var all = db.ContactMessages.AsNoTracking();
        var counts = new Dictionary<string, int>();
        foreach (var s in Statuses)
        {
            counts[s] = await InStatus(all, s).CountAsync(cancellationToken);
        }

        var list = InStatus(all, key);
        if (!string.IsNullOrWhiteSpace(q))
        {
            // La intercalación de la BD ya ignora mayúsculas y acentos.
            var like = OrderAdminService.LikePattern(q);
            list = list.Where(m => EF.Functions.Like(m.Name, like, "\\") || EF.Functions.Like(m.Email, like, "\\")
                || EF.Functions.Like(m.Subject, like, "\\") || EF.Functions.Like(m.Message, like, "\\"));
        }

        var total = await list.CountAsync(cancellationToken);
        var current = Math.Max(1, page);
        var rows = await list.Include(m => m.HandledBy)
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Skip((current - 1) * PageSize).Take(PageSize)
            .ToListAsync(cancellationToken);
        return new AdminMessageListDto(rows.Select(ToDto).ToList(), counts, total, current, PageSize);
    }

    public Task<int> UnreadCountAsync(CancellationToken cancellationToken = default) =>
        InStatus(db.ContactMessages.AsNoTracking(), "nuevos").CountAsync(cancellationToken);

    public async Task<AdminResult<AdminMessageDto>> ApplyAsync(int id, InboxAction action, StaffActor actor, CancellationToken cancellationToken = default)
    {
        var message = await db.ContactMessages.Include(m => m.HandledBy).SingleOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (message is null)
        {
            return AdminResult<AdminMessageDto>.NotFound(NotFoundMessage);
        }

        var now = clock.UtcNow;
        var changed = action switch
        {
            InboxAction.Read when message.ReadAt is null => Set(() => message.ReadAt = now),
            InboxAction.Unread when message.ReadAt is not null => Set(() => message.ReadAt = null),
            InboxAction.Archive when message.ArchivedAt is null => Set(() => message.ArchivedAt = now),
            InboxAction.Unarchive when message.ArchivedAt is not null => Set(() => message.ArchivedAt = null),
            _ => false,
        };
        if (changed)
        {
            message.HandledByUserId = actor.Id;
            await db.SaveChangesAsync(cancellationToken);
            await db.Entry(message).Reference(m => m.HandledBy).LoadAsync(cancellationToken);
        }
        return AdminResult<AdminMessageDto>.Ok(ToDto(message));
    }

    private static bool Set(Action change)
    {
        change();
        return true;
    }
}
