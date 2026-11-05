using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>
/// Cliente del panel (solo el Dueño, customers.view). <c>Kind</c>: <c>cuenta</c> (usuario con rol Customer, <c>Id</c>) o
/// <c>invitado</c> (pedidos sin cuenta agrupados por correo, sin <c>Id</c>). Nunca lleva contraseña, tokens ni IP.
/// </summary>
public record AdminCustomerRowDto(
    int? Id,
    string Kind,
    string Name,
    string Email,
    int Orders,
    decimal Spent,
    DateTime? LastOrderAt,
    string? PreferredSize,
    bool MarketingOptIn,
    DateTime CustomerSince);

/// <summary><c>Counts</c> por tipo (todos, cuenta, invitados) con la búsqueda aplicada.</summary>
public record AdminCustomerListDto(IReadOnlyList<AdminCustomerRowDto> Customers, IReadOnlyDictionary<string, int> Counts, int Total, int Page, int PageSize);

/// <summary><c>AsGuest</c>: el pedido se hizo sin sesión, antes o sin usar la cuenta con ese correo ("Como invitado").</summary>
public record AdminCustomerOrderDto(string Folio, DateTime CreatedAt, OrderStatus Status, PaymentStatus PaymentStatus, decimal Total, bool AsGuest = false);

public record AdminCustomerAddressDto(string Street, string Neighborhood, string City, string State, string PostalCode, string? References);

/// <summary><c>Favorites</c> es <c>null</c> para invitados (sin cuenta no hay favoritos).</summary>
public record AdminCustomerDetailDto(
    AdminCustomerRowDto Customer,
    string? Phone,
    IReadOnlyList<AdminCustomerOrderDto> Orders,
    int? Favorites,
    AdminCustomerAddressDto? LastAddress);
