using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Cuenta de cliente o de personal interno (DESIGN_DB §3.1).</summary>
public class User
{
    public int Id { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    /// <summary>Siempre en minúsculas y sin espacios (R-01).</summary>
    public string Email { get; set; } = null!;
    /// <summary>Salida de <c>PasswordHasher&lt;User&gt;</c>; nunca texto plano.</summary>
    public string PasswordHash { get; set; } = null!;
    public UserRole Role { get; set; } = UserRole.Customer;
    /// <summary>Talla preferida del sistema <see cref="SizeSystem.Calceta"/> (lo valida el servicio).</summary>
    public int? PreferredSizeId { get; set; }
    public bool MarketingOptIn { get; set; }
    public DateTime? AcceptedTermsAt { get; set; }
    public DateTime? EmailConfirmedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Se expone como <c>memberSince</c>.</summary>
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Size? PreferredSize { get; set; }
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = [];
    public ICollection<Order> Orders { get; set; } = [];
}
