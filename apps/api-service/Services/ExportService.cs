using System.Text;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de utilidad: archivos que salen del panel (DESIGN_DB §6.1). En v1, la plantilla CSV de inventario.</summary>
public interface IExportService
{
    /// <summary>Los SKU actuales con su stock y datos de catálogo; importable tal cual. <c>unit_cost</c> solo si <paramref name="includeCosts"/>.</summary>
    Task<string> InventoryTemplateAsync(bool includeCosts, CancellationToken cancellationToken = default);
}

public class ExportService(SokkoDbContext db) : IExportService
{
    public async Task<string> InventoryTemplateAsync(bool includeCosts, CancellationToken cancellationToken = default)
    {
        var variants = await db.ProductVariants
            .AsNoTracking()
            .Where(v => v.IsActive)
            .Include(v => v.Product).ThenInclude(p => p.Brand)
            .Include(v => v.Product).ThenInclude(p => p.ProductType)
            .Include(v => v.Product).ThenInclude(p => p.Collection)
            .Include(v => v.Color)
            .Include(v => v.Size)
            .OrderBy(v => v.Product.Line == ProductLine.Sokko ? 0 : v.Product.Line == ProductLine.Marcas ? 1 : v.Product.Line == ProductLine.Especiales ? 2 : 3)
            .ThenBy(v => v.Product.CreatedAt)
            .ThenBy(v => v.Id)
            .ToListAsync(cancellationToken);

        // Lleva BOM para que Excel lo abra como UTF-8.
        var csv = new StringBuilder("﻿");
        csv.Append(string.Join(',', InventoryCsv.Columns.Concat(InventoryCsv.ExtraColumns))).Append("\r\n");
        foreach (var v in variants)
        {
            var p = v.Product;
            object?[] cells =
            [
                v.Sku, p.Name, v.Color.Name, v.Size.Code, v.Stock,
                p.Line.ToString().ToLowerInvariant(), p.Brand.Slug, p.ProductType.Code, p.Collection?.Slug, p.UnitsPerPack, includeCosts ? v.UnitCost : null, v.Barcode,
            ];
            csv.Append(string.Join(',', cells.Select(InventoryCsv.Cell))).Append("\r\n");
        }
        return csv.ToString();
    }
}
