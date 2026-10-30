namespace Sokko.Api.Models;

/// <summary>Token de un solo uso para restablecer la contraseña, válido 30 minutos (DESIGN_DB §3.2).</summary>
public class PasswordResetToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    /// <summary>SHA-256 del token; el token en claro solo viaja en el correo.</summary>
    public byte[] TokenHash { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }

    public User User { get; set; } = null!;
}
