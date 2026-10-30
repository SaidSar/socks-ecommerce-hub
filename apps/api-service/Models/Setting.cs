namespace Sokko.Api.Models;

/// <summary>Configuración del negocio: una sola fila con <c>Id = 1</c> (DESIGN_DB §3.12).</summary>
public class Setting
{
    public const byte SingletonId = 1;

    public byte Id { get; set; } = SingletonId;
    public decimal FreeShippingThreshold { get; set; }
    public decimal ParcelShippingCost { get; set; }
    public decimal LocalShippingCost { get; set; }
    /// <summary>El umbral de envío gratis también aplica a la entrega local.</summary>
    public bool LocalFreeShipping { get; set; } = true;
    public int FewUnitsThreshold { get; set; }
    public decimal IvaRate { get; set; }
    /// <summary>Pieza del hero; de la línea Sokko (lo valida el servicio).</summary>
    public int? FeaturedProductId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = null!;

    public Product? FeaturedProduct { get; set; }
    public User? UpdatedByUser { get; set; }
}
