namespace Sokko.Api.Models;

/// <summary>Rango de CP con entrega local por repartidor (DESIGN_DB §3.13).</summary>
public class LocalDeliveryZone
{
    public int Id { get; set; }
    public string PostalCodeFrom { get; set; } = null!;
    /// <summary>Un CP suelto se guarda con <c>From = To</c>.</summary>
    public string PostalCodeTo { get; set; } = null!;
    public string Label { get; set; } = null!;
    /// <summary><c>false</c> = por confirmar con el cliente (informativo, P-06).</summary>
    public bool IsConfirmed { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}
