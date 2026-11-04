using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Filtros de la lista de clientes. <c>Type</c>: todos, cuenta o invitados. <c>Sort</c>: ultima_compra, total, pedidos o alta.</summary>
public record CustomerQuery(string? Type, string? Q, string? Sort, int Page = 1);

/// <summary>Servicio de entidad de solo lectura: clientes del panel (solo el Dueño).</summary>
public interface ICustomerAdminService
{
    /// <summary><c>null</c> si el tipo o el orden no existen.</summary>
    Task<AdminCustomerListDto?> ListAsync(CustomerQuery query, CancellationToken cancellationToken = default);

    Task<AdminCustomerDetailDto?> GetAsync(int id, CancellationToken cancellationToken = default);

    Task<AdminCustomerDetailDto?> GetGuestAsync(string? email, CancellationToken cancellationToken = default);

    /// <summary>La lista filtrada completa, sin paginar. <c>null</c> si el tipo o el orden no existen.</summary>
    Task<CsvFile?> ExportAsync(CustomerQuery query, CancellationToken cancellationToken = default);

    /// <summary>Solo quienes aceptaron recibir novedades (<c>MarketingOptIn</c>).</summary>
    Task<CsvFile> ExportMarketingAsync(CancellationToken cancellationToken = default);
}

public class CustomerAdminService(SokkoDbContext db, IClock clock) : ICustomerAdminService
{
    public const int PageSize = 25;
    public const string Account = "cuenta";
    public const string Guest = "invitado";

    public static readonly string[] Types = ["todos", "cuenta", "invitados"];
    public static readonly string[] Sorts = ["ultima_compra", "total", "pedidos", "alta"];

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static bool Counts(OrderStatus status) => status != OrderStatus.Cancelado;

    private static bool IsSale(OrderStatus status, PaymentStatus payment) => status != OrderStatus.Cancelado && payment == PaymentStatus.Pagado;

    private async Task<List<AdminCustomerRowDto>> AllAsync(CancellationToken cancellationToken)
    {
        var accounts = await db.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Customer)
            .Select(u => new
            {
                u.Id,
                u.FirstName,
                u.LastName,
                u.Email,
                u.MarketingOptIn,
                u.CreatedAt,
                Size = u.PreferredSize != null ? u.PreferredSize.Code : null,
                Orders = u.Orders.Count(o => o.Status != OrderStatus.Cancelado),
                Spent = u.Orders.Where(o => o.Status != OrderStatus.Cancelado && o.PaymentStatus == PaymentStatus.Pagado).Sum(o => (decimal?)o.Total) ?? 0,
                Last = u.Orders.Where(o => o.Status != OrderStatus.Cancelado).Max(o => (DateTime?)o.CreatedAt),
            })
            .ToListAsync(cancellationToken);

        var rows = accounts.Select(u => new AdminCustomerRowDto(
            u.Id, Account, $"{u.FirstName} {u.LastName}".Trim(), u.Email, u.Orders, u.Spent, u.Last is { } last ? Utc(last) : null, u.Size, u.MarketingOptIn, Utc(u.CreatedAt)))
            .ToList();

        var guestOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.UserId == null)
            .Select(o => new { o.CustomerEmail, o.CustomerFirstName, o.CustomerLastName, o.CreatedAt, o.Status, o.PaymentStatus, o.Total })
            .ToListAsync(cancellationToken);

        rows.AddRange(guestOrders
            .GroupBy(o => NormalizeEmail(o.CustomerEmail))
            .Select(g =>
            {
                var latest = g.MaxBy(o => o.CreatedAt)!;
                var counted = g.Where(o => Counts(o.Status)).ToList();
                return new AdminCustomerRowDto(
                    null,
                    Guest,
                    $"{latest.CustomerFirstName} {latest.CustomerLastName}".Trim(),
                    g.Key,
                    counted.Count,
                    g.Where(o => IsSale(o.Status, o.PaymentStatus)).Sum(o => o.Total),
                    counted.Count == 0 ? null : Utc(counted.Max(o => o.CreatedAt)),
                    null,
                    false,
                    Utc(g.Min(o => o.CreatedAt)));
            }));
        return rows;
    }

    private static bool Matches(AdminCustomerRowDto row, string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return true;
        }
        var term = InventoryCsv.Normalize(q);
        return InventoryCsv.Normalize(row.Name).Contains(term, StringComparison.Ordinal) || row.Email.Contains(term, StringComparison.OrdinalIgnoreCase);
    }

    private static bool OfType(AdminCustomerRowDto row, string type) => type switch
    {
        "cuenta" => row.Kind == Account,
        "invitados" => row.Kind == Guest,
        _ => true,
    };

    private static IEnumerable<AdminCustomerRowDto> Sorted(IEnumerable<AdminCustomerRowDto> rows, string sort)
    {
        var ordered = sort switch
        {
            "total" => rows.OrderByDescending(r => r.Spent),
            "pedidos" => rows.OrderByDescending(r => r.Orders),
            "alta" => rows.OrderByDescending(r => r.CustomerSince),
            // Sin compras van al final.
            _ => rows.OrderByDescending(r => r.LastOrderAt ?? DateTime.MinValue),
        };
        return ordered.ThenBy(r => r.Name, StringComparer.Create(CultureInfo.GetCultureInfo("es-MX"), true)).ThenBy(r => r.Email, StringComparer.Ordinal);
    }

    /// <summary>Filas que cumplen búsqueda y tipo, ya ordenadas; <c>null</c> si el tipo o el orden no existen.</summary>
    private async Task<(List<AdminCustomerRowDto> Rows, Dictionary<string, int> Counts)?> FilterAsync(CustomerQuery query, CancellationToken cancellationToken)
    {
        var type = string.IsNullOrEmpty(query.Type) ? "todos" : query.Type;
        var sort = string.IsNullOrEmpty(query.Sort) ? "ultima_compra" : query.Sort;
        if (!Types.Contains(type) || !Sorts.Contains(sort))
        {
            return null;
        }

        var found = (await AllAsync(cancellationToken)).Where(r => Matches(r, query.Q)).ToList();
        var counts = Types.ToDictionary(t => t, t => found.Count(r => OfType(r, t)));
        return (Sorted(found.Where(r => OfType(r, type)), sort).ToList(), counts);
    }

    public async Task<AdminCustomerListDto?> ListAsync(CustomerQuery query, CancellationToken cancellationToken = default)
    {
        if (await FilterAsync(query, cancellationToken) is not var (rows, counts))
        {
            return null;
        }
        var page = Math.Max(1, query.Page);
        return new AdminCustomerListDto(rows.Skip((page - 1) * PageSize).Take(PageSize).ToList(), counts, rows.Count, page, PageSize);
    }

    private static List<AdminCustomerOrderDto> OrdersOf(IEnumerable<Order> orders) =>
        orders.Select(o => new AdminCustomerOrderDto(o.Folio, o.CreatedAt, o.Status, o.PaymentStatus, o.Total)).ToList();

    private static AdminCustomerAddressDto? AddressOf(Order? o) =>
        o is null ? null : new AdminCustomerAddressDto(o.ShipStreet, o.ShipNeighborhood, o.ShipCity, o.ShipState, o.ShipPostalCode, o.ShipReferences);

    public async Task<AdminCustomerDetailDto?> GetAsync(int id, CancellationToken cancellationToken = default)
    {
        if (!await db.Users.AnyAsync(u => u.Id == id && u.Role == UserRole.Customer, cancellationToken))
        {
            return null;
        }
        var row = (await AllAsync(cancellationToken)).Single(r => r.Id == id);
        var orders = await db.Orders.AsNoTracking().Where(o => o.UserId == id).OrderByDescending(o => o.CreatedAt).ToListAsync(cancellationToken);
        var favorites = await db.WishlistItems.CountAsync(w => w.UserId == id, cancellationToken);
        return new AdminCustomerDetailDto(row, orders.FirstOrDefault()?.CustomerPhone, OrdersOf(orders), favorites, AddressOf(orders.FirstOrDefault()));
    }

    public async Task<AdminCustomerDetailDto?> GetGuestAsync(string? email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }
        var key = NormalizeEmail(email);
        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.UserId == null && o.CustomerEmail.Trim().ToLower() == key)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
        if (orders.Count == 0)
        {
            return null;
        }
        var row = (await AllAsync(cancellationToken)).Single(r => r.Kind == Guest && r.Email == key);
        return new AdminCustomerDetailDto(row, orders[0].CustomerPhone, OrdersOf(orders), null, AddressOf(orders[0]));
    }

    private static string? LocalDate(DateTime? utc) => utc is { } value ? BusinessTime.DateOf(value).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;

    public async Task<CsvFile?> ExportAsync(CustomerQuery query, CancellationToken cancellationToken = default)
    {
        if (await FilterAsync(query, cancellationToken) is not var (rows, _))
        {
            return null;
        }
        var csv = new CsvWriter("Nombre", "Correo", "Tipo", "Pedidos", "Total gastado", "Última compra", "Talla preferida", "Acepta novedades", "Cliente desde");
        foreach (var r in rows)
        {
            csv.Row(r.Name, r.Email, r.Kind == Account ? "Con cuenta" : "Invitado", r.Orders, r.Spent, LocalDate(r.LastOrderAt), r.PreferredSize, r.MarketingOptIn, LocalDate(r.CustomerSince));
        }
        return new CsvFile($"sokko-clientes-{clock.Today:yyyy-MM-dd}.csv", csv.ToBytes());
    }

    public async Task<CsvFile> ExportMarketingAsync(CancellationToken cancellationToken = default)
    {
        var rows = Sorted((await AllAsync(cancellationToken)).Where(r => r.MarketingOptIn), "alta");
        var csv = new CsvWriter("Nombre", "Correo", "Talla preferida", "Cliente desde");
        foreach (var r in rows)
        {
            csv.Row(r.Name, r.Email, r.PreferredSize, LocalDate(r.CustomerSince));
        }
        return new CsvFile($"sokko-contactos-novedades-{clock.Today:yyyy-MM-dd}.csv", csv.ToBytes());
    }
}
