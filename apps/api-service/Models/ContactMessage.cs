namespace Sokko.Api.Models;

/// <summary>Mensaje del formulario de contacto de la tienda. Se guarda aunque el aviso por correo falle.</summary>
public class ContactMessage
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Subject { get; set; } = null!;
    public string Message { get; set; } = null!;
    /// <summary>IP de quien lo envió (detrás del proxy, la que reporta App Service); para revisar abusos.</summary>
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Cuándo se avisó al correo de la tienda; <c>null</c> si no hay correo configurado o el envío falló.</summary>
    public DateTime? NotifiedAt { get; set; }
    /// <summary>Cuándo alguien del equipo lo abrió en la bandeja; <c>null</c> = nuevo.</summary>
    public DateTime? ReadAt { get; set; }
    /// <summary>Cuándo se archivó; <c>null</c> = sigue en Nuevos o Leídos.</summary>
    public DateTime? ArchivedAt { get; set; }
    /// <summary>Quien hizo el último cambio de estado (leer, archivar…).</summary>
    public int? HandledByUserId { get; set; }

    public User? HandledBy { get; set; }
}

/// <summary>Longitudes máximas: las comparten la tabla y <c>ContactRequestDto</c>.</summary>
public static class ContactMessageLimits
{
    public const int Name = 80;
    public const int Email = 254;
    public const int Subject = 80;
    public const int MessageMin = 10;
    public const int Message = 2000;
}
