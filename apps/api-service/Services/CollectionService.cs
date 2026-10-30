using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad de colecciones: ventana anual y descuento fuera de temporada (DESIGN_DB §3.5c).</summary>
public interface ICollectionService
{
    /// <summary>Extremos inclusivos; la ventana puede cruzar de año. Una temática o la falta de colección siempre cuentan como dentro.</summary>
    bool IsInWindow(Collection? collection, DateOnly date);

    /// <summary>Descuento que aplica en <paramref name="date"/>: el de la colección fuera de temporada, o 0.</summary>
    decimal GetDiscountPct(Collection? collection, DateOnly date);

    /// <summary>Misma regla que <see cref="IsInWindow"/>, traducida a SQL para filtrar y paginar en la consulta.</summary>
    IQueryable<Product> WhereInSeason(IQueryable<Product> products, DateOnly date);

    /// <summary>Temáticas y colecciones de temporada dentro de su ventana.</summary>
    Task<IReadOnlyList<Collection>> ListActiveAsync(DateOnly date, CancellationToken cancellationToken = default);
}

public class CollectionService(SokkoDbContext db) : ICollectionService
{
    private static int DayKey(int month, int day) => month * 100 + day;

    public bool IsInWindow(Collection? collection, DateOnly date)
    {
        if (collection is null || collection.Kind != CollectionKind.Temporada)
        {
            return true;
        }

        var today = DayKey(date.Month, date.Day);
        var start = DayKey(collection.StartMonth!.Value, collection.StartDay!.Value);
        var end = DayKey(collection.EndMonth!.Value, collection.EndDay!.Value);
        return start <= end ? today >= start && today <= end : today >= start || today <= end;
    }

    public decimal GetDiscountPct(Collection? collection, DateOnly date) =>
        IsInWindow(collection, date) ? 0m : collection!.OffSeasonDiscountPct;

    public IQueryable<Product> WhereInSeason(IQueryable<Product> products, DateOnly date)
    {
        var today = DayKey(date.Month, date.Day);
        return products.Where(p =>
            p.CollectionId == null
            || p.Collection!.Kind == CollectionKind.Tematica
            || (p.Collection.StartKey <= p.Collection.EndKey && today >= p.Collection.StartKey && today <= p.Collection.EndKey)
            || (p.Collection.StartKey > p.Collection.EndKey && (today >= p.Collection.StartKey || today <= p.Collection.EndKey)));
    }

    public async Task<IReadOnlyList<Collection>> ListActiveAsync(DateOnly date, CancellationToken cancellationToken = default)
    {
        var collections = await db.Collections
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Id)
            .ToListAsync(cancellationToken);
        return collections.Where(c => IsInWindow(c, date)).ToList();
    }
}
