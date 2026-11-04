namespace Sokko.Api.DTOs;

/// <summary>Mensaje de contacto en la bandeja del panel. Sin IP: esa solo sirve para revisar abusos en la BD.</summary>
public record AdminMessageDto(
    int Id,
    string Name,
    string Email,
    string Subject,
    string Message,
    DateTime CreatedAt,
    DateTime? ReadAt,
    DateTime? ArchivedAt,
    string? HandledBy);

/// <summary><c>Counts</c>: nuevos, leidos y archivados (sin la búsqueda, para las pestañas).</summary>
public record AdminMessageListDto(IReadOnlyList<AdminMessageDto> Messages, IReadOnlyDictionary<string, int> Counts, int Total, int Page, int PageSize);

public record AdminUnreadCountDto(int Count);
