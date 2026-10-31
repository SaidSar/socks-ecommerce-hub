using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad: único escritor de <c>Brands</c> (DESIGN_DB §6). Devuelve el slug guardado.</summary>
public interface IBrandService
{
    Task<AdminResult<string>> CreateAsync(BrandCreateDto request, CancellationToken cancellationToken = default);

    Task<AdminResult<string>> UpdateAsync(string slug, BrandUpdateDto request, CancellationToken cancellationToken = default);
}

public class BrandService(SokkoDbContext db) : IBrandService
{
    private static AdminResult<string> Taken(string name) =>
        AdminResult<string>.Conflict($"Ya existe la marca {name}.", new Dictionary<string, string> { ["name"] = $"Ya existe la marca {name}." });

    public async Task<AdminResult<string>> CreateAsync(BrandCreateDto request, CancellationToken cancellationToken = default)
    {
        var name = request.Name!.Trim();
        var slug = CatalogAdminService.Slugify(name);
        // La intercalación de la BD compara sin mayúsculas ni acentos.
        if (await db.Brands.AnyAsync(b => b.Name == name || b.Slug == slug, cancellationToken))
        {
            return Taken(name);
        }
        if (slug.Length == 0)
        {
            return AdminResult<string>.Invalid(new Dictionary<string, string> { ["name"] = "Escribe el nombre de la marca." });
        }

        db.Brands.Add(new Brand { Name = name, Slug = slug, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<string>.Ok(slug);
    }

    public async Task<AdminResult<string>> UpdateAsync(string slug, BrandUpdateDto request, CancellationToken cancellationToken = default)
    {
        var brand = await db.Brands.FirstOrDefaultAsync(b => b.Slug == slug, cancellationToken);
        if (brand is null)
        {
            return AdminResult<string>.NotFound("No encontramos esa marca.");
        }
        if (brand.IsOwnBrand && request.ShowInFilters == false)
        {
            return AdminResult<string>.Conflict("La marca propia siempre es visible.");
        }
        if (brand.IsOwnBrand && request.IsActive == false)
        {
            return AdminResult<string>.Conflict("La marca propia no se puede dar de baja.");
        }
        if (request.IsActive == false && await db.Products.AnyAsync(p => p.BrandId == brand.Id && p.IsActive, cancellationToken))
        {
            return AdminResult<string>.Conflict("Una marca con productos no se da de baja; ocúltela del filtro.");
        }

        var name = request.Name?.Trim();
        if (!string.IsNullOrEmpty(name) && await db.Brands.AnyAsync(b => b.Name == name && b.Id != brand.Id, cancellationToken))
        {
            return Taken(name);
        }

        db.Entry(brand).Property(b => b.RowVersion).OriginalValue = request.RowVersion!;
        brand.Name = string.IsNullOrEmpty(name) ? brand.Name : name;
        brand.ShowInFilters = request.ShowInFilters ?? brand.ShowInFilters;
        brand.IsActive = request.IsActive ?? brand.IsActive;
        // Marca la fila aunque no cambie nada: toda edición pasa por la comprobación de RowVersion.
        db.Entry(brand).Property(b => b.Name).IsModified = true;
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<string>.Ok(brand.Slug);
    }
}

/// <summary>Servicio de entidad: único escritor de <c>ProductTypes</c> (DESIGN_DB §6). Devuelve el código guardado.</summary>
public interface IProductTypeService
{
    Task<AdminResult<string>> CreateAsync(ProductTypeCreateDto request, CancellationToken cancellationToken = default);

    Task<AdminResult<string>> UpdateAsync(string code, ProductTypeUpdateDto request, CancellationToken cancellationToken = default);
}

public class ProductTypeService(SokkoDbContext db) : IProductTypeService
{
    private const string NameTaken = "Ya existe un tipo con ese nombre o código.";

    public async Task<AdminResult<string>> CreateAsync(ProductTypeCreateDto request, CancellationToken cancellationToken = default)
    {
        var name = request.Name!.Trim();
        if (await db.ProductTypes.AnyAsync(t => t.Code == request.Code || t.Name == name, cancellationToken))
        {
            return AdminResult<string>.Conflict(NameTaken, new Dictionary<string, string> { ["name"] = NameTaken });
        }

        var sortOrder = await db.ProductTypes.MaxAsync(t => (int?)t.SortOrder, cancellationToken) ?? 0;
        db.ProductTypes.Add(new ProductType
        {
            Code = request.Code!, Name = name, SizeSystem = request.SizeSystem!.Value, UnitLabel = request.Unit!.Value, SortOrder = (byte)(sortOrder + 1),
        });
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<string>.Ok(request.Code!);
    }

    public async Task<AdminResult<string>> UpdateAsync(string code, ProductTypeUpdateDto request, CancellationToken cancellationToken = default)
    {
        var type = await db.ProductTypes.FirstOrDefaultAsync(t => t.Code == code, cancellationToken);
        if (type is null)
        {
            return AdminResult<string>.NotFound("No encontramos ese tipo.");
        }

        var hasProducts = await db.Products.AnyAsync(p => p.ProductTypeId == type.Id, cancellationToken);
        if (request.SizeSystem is { } system && system != type.SizeSystem && hasProducts)
        {
            return AdminResult<string>.Conflict("Este tipo ya tiene productos: cambiar su sistema de tallas rompería sus SKU."); // R-32
        }
        if (request.IsActive == false && await db.Products.AnyAsync(p => p.ProductTypeId == type.Id && p.IsActive, cancellationToken))
        {
            return AdminResult<string>.Conflict("Un tipo con productos activos no se da de baja.");
        }

        var name = request.Name?.Trim();
        if (!string.IsNullOrEmpty(name) && await db.ProductTypes.AnyAsync(t => t.Name == name && t.Id != type.Id, cancellationToken))
        {
            return AdminResult<string>.Conflict(NameTaken, new Dictionary<string, string> { ["name"] = NameTaken });
        }

        db.Entry(type).Property(t => t.RowVersion).OriginalValue = request.RowVersion!;
        type.Name = string.IsNullOrEmpty(name) ? type.Name : name;
        type.SizeSystem = request.SizeSystem ?? type.SizeSystem;
        type.UnitLabel = request.Unit ?? type.UnitLabel;
        type.IsActive = request.IsActive ?? type.IsActive;
        db.Entry(type).Property(t => t.Name).IsModified = true;
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<string>.Ok(type.Code);
    }
}
