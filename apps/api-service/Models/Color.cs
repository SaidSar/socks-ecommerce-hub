namespace Sokko.Api.Models;

/// <summary>Color o diseño de una variante; los tonos Kyoto llevan <see cref="IsSokkoTone"/> (DESIGN_DB §3.3).</summary>
public class Color
{
    /// <summary>PK natural de 3 letras y parte del SKU: <c>SUM</c>, <c>NEG</c>, <c>MUL</c>.</summary>
    public string Code { get; set; } = null!;
    /// <summary>Código de API: <c>sumi</c>, <c>negro</c>.</summary>
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;
    /// <summary><c>NULL</c> en diseños estampados (<c>MUL</c>).</summary>
    public string? Hex { get; set; }
    public string? LineHex { get; set; }
    public bool IsSokkoTone { get; set; }
    public byte SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
