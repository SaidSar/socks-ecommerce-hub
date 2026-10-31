using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
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

    /// <summary>Alta desde el panel; devuelve el slug guardado.</summary>
    Task<AdminResult<string>> CreateAsync(CollectionRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>Edición desde el panel; devuelve el slug guardado.</summary>
    Task<AdminResult<string>> UpdateAsync(string slug, CollectionRequestDto request, CancellationToken cancellationToken = default);
}

public class CollectionService(SokkoDbContext db, IClock clock) : ICollectionService
{
    private const decimal MaxDiscountPct = 0.60m;

    // Febrero tiene 28: el 29 no se acepta, para que la ventana exista todos los años.
    private static readonly int[] DaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    private static int DayKey(int month, int day) => month * 100 + day;

    private static bool IsValidDay(int? month, int? day) =>
        month is >= 1 and <= 12 && day >= 1 && day <= DaysInMonth[month.Value - 1];

    private static Dictionary<string, string> Validate(CollectionKind kind, CollectionRequestDto request, decimal discount)
    {
        var errors = new Dictionary<string, string>();
        if (kind == CollectionKind.Temporada && (!IsValidDay(request.StartMonth, request.StartDay) || !IsValidDay(request.EndMonth, request.EndDay)))
        {
            errors["window"] = "Ese día no existe en el mes elegido (el 29 de febrero no se acepta).";
        }
        if (discount is < 0 or > MaxDiscountPct)
        {
            errors["discount"] = "El descuento va de 0 a 60 %.";
        }
        return errors;
    }

    private static void Apply(Collection collection, CollectionKind kind, CollectionRequestDto request, decimal discount)
    {
        var season = kind == CollectionKind.Temporada;
        collection.Kind = kind;
        collection.StartMonth = season ? (byte)request.StartMonth!.Value : null;
        collection.StartDay = season ? (byte)request.StartDay!.Value : null;
        collection.EndMonth = season ? (byte)request.EndMonth!.Value : null;
        collection.EndDay = season ? (byte)request.EndDay!.Value : null;
        collection.OffSeasonDiscountPct = discount;
    }

    public async Task<AdminResult<string>> CreateAsync(CollectionRequestDto request, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            errors["name"] = "Escribe el nombre de la colección.";
        }
        if (request.Kind is null)
        {
            errors["kind"] = "Elige el tipo de colección.";
        }
        var discount = request.OffSeasonDiscountPct ?? 0.30m;
        if (request.Kind is { } requested)
        {
            foreach (var (field, message) in Validate(requested, request, discount))
            {
                errors[field] = message;
            }
        }
        if (errors.Count > 0)
        {
            return AdminResult<string>.Invalid(errors);
        }

        var slug = CatalogAdminService.Slugify(name!);
        if (await db.Collections.AnyAsync(c => c.Name == name || c.Slug == slug, cancellationToken))
        {
            var taken = $"Ya existe la colección {name}.";
            return AdminResult<string>.Conflict(taken, new Dictionary<string, string> { ["name"] = taken });
        }

        var now = clock.UtcNow;
        var collection = new Collection { Name = name!, Slug = slug, CreatedAt = now, UpdatedAt = now };
        Apply(collection, request.Kind!.Value, request, discount);
        db.Collections.Add(collection);
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<string>.Ok(slug);
    }

    public async Task<AdminResult<string>> UpdateAsync(string slug, CollectionRequestDto request, CancellationToken cancellationToken = default)
    {
        var collection = await db.Collections.FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken);
        if (collection is null)
        {
            return AdminResult<string>.NotFound("No encontramos esa colección.");
        }

        var kind = request.Kind ?? collection.Kind;
        var discount = request.OffSeasonDiscountPct ?? collection.OffSeasonDiscountPct;
        var errors = Validate(kind, request, discount);
        if (request.RowVersion is null)
        {
            errors["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage;
        }
        if (errors.Count > 0)
        {
            return AdminResult<string>.Invalid(errors);
        }
        if (request.IsActive == false && await db.Products.AnyAsync(p => p.CollectionId == collection.Id && p.IsActive, cancellationToken))
        {
            return AdminResult<string>.Conflict("Una colección con productos activos no se da de baja."); // R-31
        }

        var name = request.Name?.Trim();
        if (!string.IsNullOrEmpty(name) && await db.Collections.AnyAsync(c => c.Name == name && c.Id != collection.Id, cancellationToken))
        {
            var taken = $"Ya existe la colección {name}.";
            return AdminResult<string>.Conflict(taken, new Dictionary<string, string> { ["name"] = taken });
        }

        db.Entry(collection).Property(c => c.RowVersion).OriginalValue = request.RowVersion!;
        collection.Name = string.IsNullOrEmpty(name) ? collection.Name : name;
        collection.IsActive = request.IsActive ?? collection.IsActive;
        // Siempre cambia: así toda edición pasa por la comprobación de RowVersion.
        collection.UpdatedAt = clock.UtcNow;
        Apply(collection, kind, request, discount);
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<string>.Ok(collection.Slug);
    }

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
