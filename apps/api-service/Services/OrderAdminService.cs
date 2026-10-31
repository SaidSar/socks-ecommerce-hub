using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Quien hace el cambio, para el historial y el kárdex: "Aiko M.".</summary>
public record StaffActor(int Id, string Name)
{
    public static StaffActor From(User user) => new(user.Id, user.LastName.Length > 0 ? $"{user.FirstName} {user.LastName[0]}." : user.FirstName);
}

/// <summary>Pedido completo dentro del servicio. Sale a la API solo por <see cref="ToOwner"/> o <see cref="ToOperations"/> (R-24).</summary>
public record AdminOrderView(OwnerOrderDto Owner)
{
    public OwnerOrderDto ToOwner() => Owner;

    public OperationsOrderDto ToOperations() => new(
        Owner.Id, Owner.Created, Owner.Status,
        Owner.Items.Select(i => new OperationsOrderItemDto(i.Sku, i.Name, i.Tone, i.ToneName, i.ToneHex, i.Size, i.Qty, i.Unit)).ToList(),
        Owner.Pay, Owner.PaymentStatus, Owner.PaidAt, Owner.Customer, Owner.Delivery, Owner.GiftWrap, Owner.FreeShipping,
        Owner.Carrier, Owner.Tracking, Owner.Courier, Owner.Note, Owner.History, Owner.RowVersion);
}

public record AdminOrderListView(IReadOnlyList<AdminOrderView> Orders, IReadOnlyDictionary<string, int> Counts, int Count, DateTime Now)
{
    public AdminOrderListDto<OwnerOrderDto> ToOwner() => new(Orders.Select(o => o.ToOwner()).ToList(), Counts, Count, Now);

    public AdminOrderListDto<OperationsOrderDto> ToOperations() => new(Orders.Select(o => o.ToOperations()).ToList(), Counts, Count, Now);
}

/// <summary>Servicio de entidad: pedidos del panel (DESIGN_ADMIN §7 y §9), con los mismos filtros que <c>domain/orders.js</c>.</summary>
public interface IOrderAdminService
{
    /// <summary><c>null</c> si el filtro no existe.</summary>
    Task<AdminOrderListView?> ListAsync(string? filter, string? query, CancellationToken cancellationToken = default);

    Task<AdminOrderSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);

    Task<AdminOrderView?> GetAsync(string folio, CancellationToken cancellationToken = default);

    Task<PackingListDto?> GetPackingListAsync(string folio, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminOrderView>> SaveNoteAsync(string folio, string? note, byte[]? rowVersion, CancellationToken cancellationToken = default);

    /// <summary>Registra a mano el pago de un OXXO pendiente: respaldo del aviso de la pasarela.</summary>
    Task<AdminResult<AdminOrderView>> MarkPaidAsync(string folio, byte[]? rowVersion, StaffActor actor, CancellationToken cancellationToken = default);

    /// <summary>Repartidores para la entrega local: el personal activo.</summary>
    Task<IReadOnlyList<string>> ListCouriersAsync(CancellationToken cancellationToken = default);
}

public class OrderAdminService(SokkoDbContext db, IUserService users, IClock clock) : IOrderAdminService
{
    public const string NotFoundMessage = "No encontramos ese pedido.";
    public static readonly TimeSpan LateAfter = TimeSpan.FromHours(48);

    private const string NoTone = "#CCCCCC";

    private static readonly Dictionary<string, OrderStatus> StatusFilters = new()
    {
        ["por_preparar"] = OrderStatus.PorPreparar,
        ["preparando"] = OrderStatus.Preparando,
        ["enviado"] = OrderStatus.Enviado,
        ["en_ruta"] = OrderStatus.EnRuta,
        ["entregado"] = OrderStatus.Entregado,
        ["cancelado"] = OrderStatus.Cancelado,
    };

    public static string UnitOf(ProductType type, byte unitsPerPack) => type.Code == "calcetas" && unitsPerPack == 1 ? "par" : "unidad";

    public static string LikePattern(string term) =>
        $"%{term.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_").Replace("[", "\\[")}%";

    private IQueryable<Order> WithDetails() =>
        db.Orders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Color)
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product).ThenInclude(p => p.ProductType)
            .Include(o => o.StatusHistory)
            .Include(o => o.Shipment)
            .AsSplitQuery();

    /// <summary>R-17: atrasado = sigue en bodega más de 48 h después de la compra.</summary>
    private static IQueryable<Order> Late(IQueryable<Order> orders, DateTime now)
    {
        var cutoff = now - LateAfter;
        return orders.Where(o => (o.Status == OrderStatus.PorPreparar || o.Status == OrderStatus.Preparando) && o.CreatedAt < cutoff);
    }

    private static IQueryable<Order> OxxoPending(IQueryable<Order> orders) =>
        orders.Where(o => o.PaymentMethod == PaymentMethod.OxxoPay && o.PaymentStatus == PaymentStatus.Pendiente && o.Status == OrderStatus.PorPreparar);

    private static AdminOrderView ToView(Order o, IReadOnlyDictionary<string, int> ordersByEmail) => new(new OwnerOrderDto(
        o.Folio,
        o.CreatedAt,
        o.Status,
        o.Items.OrderBy(i => i.Id).Select(i => new OwnerOrderItemDto(
            i.SkuSnapshot,
            i.ProductNameSnapshot,
            i.Variant.Color.Slug,
            i.ToneNameSnapshot,
            i.Variant.Color.Hex ?? NoTone,
            i.SizeCodeSnapshot,
            i.Quantity,
            UnitOf(i.Variant.Product.ProductType, i.Variant.Product.UnitsPerPack),
            i.UnitPrice)).ToList(),
        o.PaymentMethod,
        o.PaymentStatus,
        o.PaidAt,
        new AdminOrderCustomerDto($"{o.CustomerFirstName} {o.CustomerLastName}", o.CustomerEmail, $"{o.ShipCity}, {o.ShipState}", o.ShipPostalCode, ordersByEmail.GetValueOrDefault(o.CustomerEmail, 1)),
        o.DeliveryMethod,
        o.GiftWrap,
        o.ShippingCost == 0,
        o.Shipment?.Carrier is { } carrier ? CarrierCodes.ToCode(carrier) : null,
        o.Shipment?.TrackingNumber ?? "",
        o.Shipment?.CourierName ?? "",
        o.InternalNote ?? "",
        o.StatusHistory.OrderBy(h => h.ChangedAt).ThenBy(h => h.Id).Select(h => new AdminOrderHistoryDto(h.Status, h.ChangedAt, h.ChangedByName)).ToList(),
        o.RowVersion,
        o.Subtotal,
        o.ShippingCost,
        o.Total,
        o.TaxIncluded));

    private async Task<Dictionary<string, int>> OrdersByEmailAsync(IReadOnlyCollection<string> emails, CancellationToken cancellationToken) =>
        (await db.Orders
            .AsNoTracking()
            .Where(o => emails.Contains(o.CustomerEmail))
            .GroupBy(o => o.CustomerEmail)
            .Select(g => new { Email = g.Key, Orders = g.Count() })
            .ToListAsync(cancellationToken))
        .ToDictionary(x => x.Email, x => x.Orders, StringComparer.OrdinalIgnoreCase);

    public async Task<IReadOnlyList<AdminOrderView>> ToViewsAsync(IReadOnlyList<Order> orders, CancellationToken cancellationToken)
    {
        var byEmail = await OrdersByEmailAsync(orders.Select(o => o.CustomerEmail).Distinct().ToList(), cancellationToken);
        return orders.Select(o => ToView(o, byEmail)).ToList();
    }

    public async Task<AdminOrderListView?> ListAsync(string? filter, string? query, CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow;
        var selected = WithDetails();
        switch (filter)
        {
            case null or "" or "todos":
                break;
            case "late":
                selected = Late(selected, now);
                break;
            case "oxxo":
                selected = OxxoPending(selected);
                break;
            default:
                if (!StatusFilters.TryGetValue(filter, out var status))
                {
                    return null;
                }
                selected = selected.Where(o => o.Status == status);
                break;
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            // La intercalación CI_AI de la BD resuelve mayúsculas y acentos (DESIGN_DB §1.2).
            var pattern = LikePattern(query);
            selected = selected.Where(o =>
                EF.Functions.Like(o.Folio, pattern, "\\")
                || EF.Functions.Like(o.CustomerFirstName + " " + o.CustomerLastName, pattern, "\\")
                || EF.Functions.Like(o.CustomerEmail, pattern, "\\")
                || o.Items.Any(i => EF.Functions.Like(i.SkuSnapshot, pattern, "\\")));
        }

        var orders = await selected.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id).ToListAsync(cancellationToken);
        var (counts, count) = await CountsAsync(now, cancellationToken);
        return new AdminOrderListView(await ToViewsAsync(orders, cancellationToken), counts, count, now);
    }

    private async Task<(IReadOnlyDictionary<string, int> Counts, int Count)> CountsAsync(DateTime now, CancellationToken cancellationToken)
    {
        var all = db.Orders.AsNoTracking();
        var byStatus = await all.GroupBy(o => o.Status).Select(g => new { Status = g.Key, Orders = g.Count() }).ToListAsync(cancellationToken);
        var count = byStatus.Sum(s => s.Orders);
        var counts = new Dictionary<string, int>
        {
            ["todos"] = count,
            ["late"] = await Late(all, now).CountAsync(cancellationToken),
            ["oxxo"] = await OxxoPending(all).CountAsync(cancellationToken),
        };
        foreach (var (code, status) in StatusFilters)
        {
            counts[code] = byStatus.FirstOrDefault(s => s.Status == status)?.Orders ?? 0;
        }
        return (counts, count);
    }

    public async Task<AdminOrderSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var all = db.Orders.AsNoTracking();
        return new AdminOrderSummaryDto(
            await all.CountAsync(o => o.Status == OrderStatus.PorPreparar, cancellationToken),
            await Late(all, clock.UtcNow).CountAsync(cancellationToken));
    }

    public async Task<AdminOrderView?> GetAsync(string folio, CancellationToken cancellationToken = default)
    {
        var order = await WithDetails().FirstOrDefaultAsync(o => o.Folio == folio, cancellationToken);
        return order is null ? null : (await ToViewsAsync([order], cancellationToken))[0];
    }

    public async Task<PackingListDto?> GetPackingListAsync(string folio, CancellationToken cancellationToken = default)
    {
        var o = await WithDetails().FirstOrDefaultAsync(x => x.Folio == folio, cancellationToken);
        if (o is null)
        {
            return null;
        }

        var items = o.Items.OrderBy(i => i.SkuSnapshot)
            .Select(i => new PackingListItemDto(i.SkuSnapshot, i.ProductNameSnapshot, i.ToneNameSnapshot, i.SizeCodeSnapshot, i.Quantity, UnitOf(i.Variant.Product.ProductType, i.Variant.Product.UnitsPerPack)))
            .ToList();
        return new PackingListDto(
            o.Folio, o.CreatedAt, $"{o.CustomerFirstName} {o.CustomerLastName}", o.CustomerPhone, o.ShipStreet, o.ShipNeighborhood, o.ShipCity, o.ShipState,
            o.ShipPostalCode, o.ShipReferences, o.DeliveryMethod, o.GiftWrap, o.InternalNote ?? "", items, items.Sum(i => i.Qty));
    }

    public async Task<AdminResult<AdminOrderView>> SaveNoteAsync(string folio, string? note, byte[]? rowVersion, CancellationToken cancellationToken = default)
    {
        if (rowVersion is null)
        {
            return AdminResult<AdminOrderView>.Invalid(new Dictionary<string, string> { ["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage });
        }

        var order = await db.Orders.FirstOrDefaultAsync(o => o.Folio == folio, cancellationToken);
        if (order is null)
        {
            return AdminResult<AdminOrderView>.NotFound(NotFoundMessage);
        }

        db.Entry(order).Property(o => o.RowVersion).OriginalValue = rowVersion;
        order.InternalNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        // Siempre cambia: así toda edición pasa por la comprobación de RowVersion.
        order.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<AdminOrderView>.Ok((await GetAsync(folio, cancellationToken))!);
    }

    public async Task<AdminResult<AdminOrderView>> MarkPaidAsync(string folio, byte[]? rowVersion, StaffActor actor, CancellationToken cancellationToken = default)
    {
        if (rowVersion is null)
        {
            return AdminResult<AdminOrderView>.Invalid(new Dictionary<string, string> { ["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage });
        }

        var order = await db.Orders.Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Folio == folio, cancellationToken);
        if (order is null)
        {
            return AdminResult<AdminOrderView>.NotFound(NotFoundMessage);
        }
        if (order.Status == OrderStatus.Cancelado)
        {
            return AdminResult<AdminOrderView>.Conflict("Un pedido cancelado no se puede marcar como pagado.");
        }
        if (order.PaymentStatus != PaymentStatus.Pendiente)
        {
            return AdminResult<AdminOrderView>.Conflict("Este pedido ya está pagado.");
        }

        var now = clock.UtcNow;
        db.Entry(order).Property(o => o.RowVersion).OriginalValue = rowVersion;
        order.PaymentStatus = PaymentStatus.Pagado;
        order.PaidAt = now;
        order.UpdatedAt = now;
        // El historial y el pago se guardan juntos: SaveChanges abre su propia transacción (DESIGN_DB §3.10).
        order.StatusHistory.Add(new OrderStatusHistory { Status = OrderStatus.Pagado, ChangedAt = now, ChangedByUserId = actor.Id, ChangedByName = actor.Name });
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<AdminOrderView>.Ok((await GetAsync(folio, cancellationToken))!);
    }

    /// <summary>Repartidores para la entrega local: el personal activo.</summary>
    public async Task<IReadOnlyList<string>> ListCouriersAsync(CancellationToken cancellationToken = default) =>
        (await users.ListInternalAsync(cancellationToken)).Select(u => $"{u.FirstName} {u.LastName}").ToList();
}
