namespace Sokko.Api.Models.Enums;

/// <summary>Paquetería (`Shipments.Carrier`). En la API se mapea a mano a `estafeta` / `dhl_express` (DESIGN_DB §1.6).</summary>
public enum Carrier
{
    Estafeta,
    DHLExpress,
}
