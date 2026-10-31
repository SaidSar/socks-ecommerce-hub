using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

public record StockLine(int VariantId, int Quantity);

public record StockShortage(int VariantId, int Requested, int Available);

public record VariantSpec(string Sku, string ColorCode, int SizeId, string? Barcode, decimal? UnitCost);

/// <summary>Servicio de entidad: único escritor de <c>ProductVariants</c> (DESIGN_DB §4.1 y §6).</summary>
public interface IInventoryService
{
    /// <summary>Variantes con su producto, colección, color y talla, para vender.</summary>
    Task<IReadOnlyList<ProductVariant>> GetForSaleAsync(IReadOnlyCollection<string> skus, CancellationToken cancellationToken = default);

    /// <summary>
    /// Aparta cada línea con un UPDATE atómico condicionado, en orden ascendente de <c>VariantId</c> (R-08). Devuelve las que no
    /// alcanzaron; si hay alguna, la transacción debe revertirse.
    /// </summary>
    Task<IReadOnlyList<StockShortage>> ReserveAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default);

    /// <summary>Libera lo apartado, en el mismo orden (R-10). Una fila no afectada es una inconsistencia.</summary>
    Task ReleaseAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deja las variantes del producto como pide el catálogo: alta con stock 0, reactivación, costo y código de barras; las que ya
    /// no van pasan a inactivas (baja lógica). Devuelve los SKU que no se pueden dar de baja porque tienen apartados.
    /// </summary>
    Task<IReadOnlyList<string>> SyncVariantsAsync(int productId, IReadOnlyList<VariantSpec> variants, CancellationToken cancellationToken = default);
}

public class InventoryService(SokkoDbContext db) : IInventoryService
{
    public async Task<IReadOnlyList<ProductVariant>> GetForSaleAsync(IReadOnlyCollection<string> skus, CancellationToken cancellationToken = default) =>
        await db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product).ThenInclude(p => p.Collection)
            .Include(v => v.Color)
            .Include(v => v.Size)
            .Where(v => skus.Contains(v.Sku) && v.IsActive && v.Product.IsActive)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockShortage>> ReserveAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default)
    {
        var shortages = new List<StockShortage>();
        foreach (var line in lines.OrderBy(l => l.VariantId))
        {
            var rows = await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE dbo.ProductVariants SET Reserved = Reserved + {line.Quantity} WHERE Id = {line.VariantId} AND IsActive = 1 AND Stock - Reserved >= {line.Quantity}",
                cancellationToken);
            if (rows != 1)
            {
                // Se revisan todas las líneas: el cliente recibe de una vez lo que falta.
                var available = await db.ProductVariants
                    .Where(v => v.Id == line.VariantId)
                    .Select(v => v.Stock - v.Reserved)
                    .FirstOrDefaultAsync(cancellationToken);
                shortages.Add(new StockShortage(line.VariantId, line.Quantity, Math.Max(0, available)));
            }
        }
        return shortages;
    }

    public async Task<IReadOnlyList<string>> SyncVariantsAsync(int productId, IReadOnlyList<VariantSpec> variants, CancellationToken cancellationToken = default)
    {
        var existing = await db.ProductVariants.Where(v => v.ProductId == productId).ToListAsync(cancellationToken);
        var wanted = variants.Select(v => v.Sku).ToHashSet();
        var blocked = existing.Where(v => v.IsActive && v.Reserved > 0 && !wanted.Contains(v.Sku)).Select(v => v.Sku).ToList();
        if (blocked.Count > 0)
        {
            return blocked;
        }

        foreach (var variant in existing.Where(v => !wanted.Contains(v.Sku)))
        {
            variant.IsActive = false;
        }
        foreach (var spec in variants)
        {
            var variant = existing.FirstOrDefault(v => v.Sku == spec.Sku);
            if (variant is null)
            {
                db.ProductVariants.Add(new ProductVariant
                {
                    ProductId = productId, ColorCode = spec.ColorCode, SizeId = spec.SizeId, Sku = spec.Sku, Barcode = spec.Barcode, UnitCost = spec.UnitCost,
                });
                continue;
            }
            variant.IsActive = true;
            variant.Barcode = spec.Barcode;
            variant.UnitCost = spec.UnitCost;
        }
        await db.SaveChangesAsync(cancellationToken);
        return [];
    }

    public async Task ReleaseAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default)
    {
        foreach (var line in lines.OrderBy(l => l.VariantId))
        {
            var rows = await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE dbo.ProductVariants SET Reserved = Reserved - {line.Quantity} WHERE Id = {line.VariantId} AND Reserved >= {line.Quantity}",
                cancellationToken);
            if (rows != 1)
            {
                throw new InvalidOperationException($"Apartados inconsistentes en la variante {line.VariantId}.");
            }
        }
    }
}
