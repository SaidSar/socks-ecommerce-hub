namespace Sokko.Api.Models;

/// <summary>Producto guardado en los favoritos de un cliente. Uno por par usuario-producto.</summary>
public class WishlistItem
{
    public int UserId { get; set; }
    public int ProductId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
