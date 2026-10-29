using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Entrada de la línea de tiempo del pedido (DESIGN_DB §3.10).</summary>
public class OrderStatusHistory
{
    public long Id { get; set; }
    public int OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime ChangedAt { get; set; }
    /// <summary><c>NULL</c> = sistema.</summary>
    public int? ChangedByUserId { get; set; }
    public string ChangedByName { get; set; } = null!;
    public string? Note { get; set; }

    public Order Order { get; set; } = null!;
    public User? ChangedByUser { get; set; }
}
