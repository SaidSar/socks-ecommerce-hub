using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad: consultas de inventario del panel (DESIGN_ADMIN §7). Escribir es de <see cref="IInventoryService"/>.</summary>
public interface IInventoryAdminService
{
    /// <summary><c>null</c> si el filtro no existe.</summary>
    Task<InventoryListDto?> ListAsync(string? state, string? query, CancellationToken cancellationToken = default);

    Task<InventoryRowDto?> GetAsync(string sku, CancellationToken cancellationToken = default);

    /// <summary>Kárdex del más reciente al más antiguo; <c>null</c> si el SKU no existe.</summary>
    Task<IReadOnlyList<InventoryMovementDto>?> ListMovementsAsync(string sku, CancellationToken cancellationToken = default);
}

public class InventoryAdminService(SokkoDbContext db, ISettingsService settings) : IInventoryAdminService
{
    public const string Sold = "agotado";
    public const string Few = "pocos";
    public const string Ok = "ok";

    private const string NoTone = "#CCCCCC";

    /// <summary>agotado (≤ 0) · pocos (≤ umbral) · ok. "Disponible" y el estado no se guardan: el umbral cambia (DESIGN_DB §3.6).</summary>
    public static string StateOf(int available, int few) => available <= 0 ? Sold : available <= few ? Few : Ok;

    private static bool MatchesState(string state, string filter) => filter switch
    {
        "todos" => true,
        "alertas" => state != Ok,
        _ => state == filter,
    };

    private static readonly string[] Filters = ["todos", "alertas", Sold, Few, Ok];

    private IQueryable<ProductVariant> ActiveVariants() =>
        db.ProductVariants
            .AsNoTracking()
            .Where(v => v.IsActive)
            .Include(v => v.Product).ThenInclude(p => p.ProductType)
            .Include(v => v.Color)
            .Include(v => v.Size);

    private static InventoryRowDto ToRow(ProductVariant v, int few)
    {
        var available = v.Stock - v.Reserved;
        return new InventoryRowDto(
            v.Sku, v.Product.Slug, v.Product.Name, v.Color.Slug, v.Color.Name, v.Color.Hex ?? NoTone, v.Size.Code,
            v.Stock, v.Reserved, available, StateOf(available, few), v.Product.EditionSize, v.Product.Line,
            OrderAdminService.UnitOf(v.Product.ProductType, v.Product.UnitsPerPack), v.RowVersion);
    }

    public async Task<InventoryListDto?> ListAsync(string? state, string? query, CancellationToken cancellationToken = default)
    {
        var filter = string.IsNullOrEmpty(state) ? "todos" : state;
        if (!Filters.Contains(filter))
        {
            return null;
        }

        var few = (await settings.GetConfigAsync(cancellationToken)).FewUnitsThreshold;
        // Son pocos cientos de SKU: los contadores de las pestañas no dependen de la búsqueda.
        var all = (await ActiveVariants()
                .OrderBy(v => v.Product.Line == ProductLine.Sokko ? 0 : v.Product.Line == ProductLine.Marcas ? 1 : v.Product.Line == ProductLine.Especiales ? 2 : 3)
                .ThenBy(v => v.Product.CreatedAt)
                .ThenBy(v => v.Id)
                .ToListAsync(cancellationToken))
            .Select(v => ToRow(v, few))
            .ToList();

        var rows = all;
        if (!string.IsNullOrWhiteSpace(query))
        {
            var pattern = OrderAdminService.LikePattern(query);
            var matches = (await db.ProductVariants
                    .AsNoTracking()
                    .Where(v => EF.Functions.Like(v.Sku, pattern, "\\") || EF.Functions.Like(v.Product.Name, pattern, "\\") || EF.Functions.Like(v.Color.Name, pattern, "\\"))
                    .Select(v => v.Sku)
                    .ToListAsync(cancellationToken))
                .ToHashSet();
            rows = all.Where(r => matches.Contains(r.Sku)).ToList();
        }

        var counts = Filters.ToDictionary(f => f, f => all.Count(r => MatchesState(r.State, f)));
        var stats = new InventoryStatsDto(all.Sum(r => r.Stock), all.Sum(r => r.Reserved), counts[Sold], counts[Few]);
        return new InventoryListDto(rows.Where(r => MatchesState(r.State, filter)).ToList(), counts, stats, few, all.Count);
    }

    public async Task<InventoryRowDto?> GetAsync(string sku, CancellationToken cancellationToken = default)
    {
        var variant = await ActiveVariants().FirstOrDefaultAsync(v => v.Sku == sku, cancellationToken);
        return variant is null ? null : ToRow(variant, (await settings.GetConfigAsync(cancellationToken)).FewUnitsThreshold);
    }

    public async Task<IReadOnlyList<InventoryMovementDto>?> ListMovementsAsync(string sku, CancellationToken cancellationToken = default)
    {
        if (!await db.ProductVariants.AnyAsync(v => v.Sku == sku, cancellationToken))
        {
            return null;
        }

        return await db.InventoryMovements
            .AsNoTracking()
            .Where(m => m.Variant.Sku == sku)
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.Id)
            .Select(m => new InventoryMovementDto(m.Variant.Sku, m.Type, m.Quantity, m.Balance, m.CreatedAt, m.CreatedByName, m.Note, m.Order == null ? null : m.Order.Folio))
            .ToListAsync(cancellationToken);
    }
}
