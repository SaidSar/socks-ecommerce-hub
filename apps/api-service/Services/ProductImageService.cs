using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

/// <summary>Formato de una foto según sus primeros bytes, no según su nombre ni el <c>Content-Type</c> que manda el navegador.</summary>
public record ImageFormat(string Extension, string ContentType)
{
    public static readonly ImageFormat Jpeg = new(".jpg", "image/jpeg");
    public static readonly ImageFormat Png = new(".png", "image/png");
    public static readonly ImageFormat Webp = new(".webp", "image/webp");

    /// <summary>Bytes que hacen falta para reconocer los tres formatos.</summary>
    public const int HeaderLength = 12;

    private static ReadOnlySpan<byte> JpegMagic => [0xFF, 0xD8, 0xFF];
    private static ReadOnlySpan<byte> PngMagic => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    /// <summary><c>null</c> si no es JPG, PNG ni WebP.</summary>
    public static ImageFormat? Detect(ReadOnlySpan<byte> header)
    {
        if (header.StartsWith(JpegMagic))
        {
            return Jpeg;
        }
        if (header.StartsWith(PngMagic))
        {
            return Png;
        }
        // RIFF <tamaño de 4 bytes> WEBP
        if (header.Length >= HeaderLength && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8))
        {
            return Webp;
        }
        return null;
    }
}

/// <summary>Servicio de entidad: fotos de producto del panel. El archivo lo guarda <see cref="IImageStorage"/>; la fila, la BD.</summary>
public interface IProductImageService
{
    /// <summary><c>false</c> sin almacenamiento configurado: subir y borrar responden 503.</summary>
    bool CanStore { get; }

    Task<AdminResult<AdminProductImagesDto>> AddAsync(int productId, Stream content, long length, string? altText, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminProductImagesDto>> DeleteAsync(int productId, int imageId, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminProductImagesDto>> ReorderAsync(int productId, IReadOnlyList<int>? imageIds, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminProductImagesDto>> SetAltTextAsync(int productId, int imageId, string? altText, CancellationToken cancellationToken = default);
}

public class ProductImageService(
    SokkoDbContext db,
    IUnitOfWork unitOfWork,
    IImageStorage storage,
    IClock clock,
    ILogger<ProductImageService> logger) : IProductImageService
{
    public const long MaxBytes = 5 * 1024 * 1024;
    public const int MaxImagesPerProduct = 6;
    public const int MaxAltTextLength = 200;

    private const string ProductNotFound = "No encontramos ese producto.";
    private const string ImageNotFound = "No encontramos esa foto.";

    public static AdminProductImageDto ToDto(ProductImage image) => new(image.Id, image.Url, image.AltText, image.SortOrder);

    public bool CanStore => storage.IsConfigured;

    private static AdminResult<AdminProductImagesDto> NoStorage() => AdminResult<AdminProductImagesDto>.Unavailable(UnconfiguredImageStorage.Message);

    public async Task<AdminResult<AdminProductImagesDto>> AddAsync(int productId, Stream content, long length, string? altText, CancellationToken cancellationToken = default)
    {
        if (!CanStore)
        {
            return NoStorage();
        }
        if (!await db.Products.AnyAsync(p => p.Id == productId, cancellationToken))
        {
            return AdminResult<AdminProductImagesDto>.NotFound(ProductNotFound);
        }
        if (length > MaxBytes)
        {
            return AdminResult<AdminProductImagesDto>.TooLarge("La foto pesa más de 5 MB.");
        }

        var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, cancellationToken);
        if (buffer.Length > MaxBytes)
        {
            return AdminResult<AdminProductImagesDto>.TooLarge("La foto pesa más de 5 MB.");
        }

        var errors = new Dictionary<string, string>();
        var format = ImageFormat.Detect(buffer.GetBuffer().AsSpan(0, (int)Math.Min(buffer.Length, ImageFormat.HeaderLength)));
        if (buffer.Length == 0)
        {
            errors["file"] = "Elige una foto.";
        }
        else if (format is null)
        {
            errors["file"] = "Solo se aceptan fotos JPG, PNG o WebP.";
        }
        var alt = Clean(altText);
        if (alt?.Length > MaxAltTextLength)
        {
            errors["altText"] = "El texto alternativo admite hasta 200 caracteres.";
        }
        var count = await db.ProductImages.CountAsync(i => i.ProductId == productId, cancellationToken);
        if (count >= MaxImagesPerProduct)
        {
            errors["file"] = $"Cada producto admite hasta {MaxImagesPerProduct} fotos.";
        }
        if (errors.Count > 0)
        {
            return AdminResult<AdminProductImagesDto>.Invalid(errors);
        }

        // Primero el archivo y luego la fila: si la BD falla, se borra el archivo y no queda una fila sin foto.
        var blobName = $"products/{productId}/{Guid.NewGuid():N}{format!.Extension}";
        buffer.Position = 0;
        var url = await storage.UploadAsync(blobName, buffer, format.ContentType, cancellationToken);
        try
        {
            await unitOfWork.InTransactionAsync(async ct =>
            {
                var sortOrder = await db.ProductImages.CountAsync(i => i.ProductId == productId, ct);
                db.ProductImages.Add(new ProductImage { ProductId = productId, BlobName = blobName, Url = url, AltText = alt, SortOrder = sortOrder });
                await db.SaveChangesAsync(ct);
                await SyncCoverAsync(productId, ct);
                return (true, true);
            }, cancellationToken);
        }
        catch
        {
            await storage.DeleteAsync(blobName, CancellationToken.None);
            throw;
        }
        return AdminResult<AdminProductImagesDto>.Ok(await ImagesOfAsync(productId, cancellationToken));
    }

    public async Task<AdminResult<AdminProductImagesDto>> DeleteAsync(int productId, int imageId, CancellationToken cancellationToken = default)
    {
        // Sin almacenamiento no se borra la fila: el archivo quedaría huérfano en la cuenta.
        if (!CanStore)
        {
            return NoStorage();
        }
        var blobName = await unitOfWork.InTransactionAsync<string?>(async ct =>
        {
            var images = await db.ProductImages.Where(i => i.ProductId == productId).OrderBy(i => i.SortOrder).ToListAsync(ct);
            var image = images.FirstOrDefault(i => i.Id == imageId);
            if (image is null)
            {
                return (null, false);
            }
            db.ProductImages.Remove(image);
            Renumber(images.Where(i => i != image));
            await db.SaveChangesAsync(ct);
            await SyncCoverAsync(productId, ct);
            return (image.BlobName, true);
        }, cancellationToken);

        if (blobName is null)
        {
            return await NotFoundAsync(productId, cancellationToken);
        }
        try
        {
            await storage.DeleteAsync(blobName, cancellationToken);
        }
        catch (Exception ex)
        {
            // La fila ya no existe, así que la foto ya no se muestra; el archivo huérfano solo ocupa espacio.
            logger.LogWarning(ex, "No se pudo borrar el archivo {BlobName} de la foto {ImageId}", blobName, imageId);
        }
        return AdminResult<AdminProductImagesDto>.Ok(await ImagesOfAsync(productId, cancellationToken));
    }

    public async Task<AdminResult<AdminProductImagesDto>> ReorderAsync(int productId, IReadOnlyList<int>? imageIds, CancellationToken cancellationToken = default)
    {
        if (!await db.Products.AnyAsync(p => p.Id == productId, cancellationToken))
        {
            return AdminResult<AdminProductImagesDto>.NotFound(ProductNotFound);
        }

        var invalid = await unitOfWork.InTransactionAsync(async ct =>
        {
            var images = await db.ProductImages.Where(i => i.ProductId == productId).ToListAsync(ct);
            var ids = imageIds ?? [];
            if (ids.Count != images.Count || ids.Distinct().Count() != ids.Count || !images.All(i => ids.Contains(i.Id)))
            {
                return (true, false);
            }
            Renumber(ids.Select(id => images.First(i => i.Id == id)));
            await db.SaveChangesAsync(ct);
            await SyncCoverAsync(productId, ct);
            return (false, true);
        }, cancellationToken);

        return invalid
            ? AdminResult<AdminProductImagesDto>.Invalid(new Dictionary<string, string> { ["imageIds"] = "Manda todas las fotos del producto, cada una una vez." })
            : AdminResult<AdminProductImagesDto>.Ok(await ImagesOfAsync(productId, cancellationToken));
    }

    public async Task<AdminResult<AdminProductImagesDto>> SetAltTextAsync(int productId, int imageId, string? altText, CancellationToken cancellationToken = default)
    {
        var image = await db.ProductImages.FirstOrDefaultAsync(i => i.ProductId == productId && i.Id == imageId, cancellationToken);
        if (image is null)
        {
            return await NotFoundAsync(productId, cancellationToken);
        }
        var alt = Clean(altText);
        if (alt?.Length > MaxAltTextLength)
        {
            return AdminResult<AdminProductImagesDto>.Invalid(new Dictionary<string, string> { ["altText"] = "El texto alternativo admite hasta 200 caracteres." });
        }
        image.AltText = alt;
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<AdminProductImagesDto>.Ok(await ImagesOfAsync(productId, cancellationToken));
    }

    private static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    private static void Renumber(IEnumerable<ProductImage> ordered)
    {
        var order = 0;
        foreach (var image in ordered)
        {
            image.SortOrder = order++;
        }
    }

    /// <summary><c>Products.ImageUrl</c> es siempre la primera foto: la tarjeta de la tienda la usa sin cargar la galería.</summary>
    private async Task SyncCoverAsync(int productId, CancellationToken cancellationToken)
    {
        var cover = await db.ProductImages.Where(i => i.ProductId == productId).OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefaultAsync(cancellationToken);
        var now = clock.UtcNow;
        await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(u => u
            .SetProperty(p => p.ImageUrl, cover)
            .SetProperty(p => p.UpdatedAt, now), cancellationToken);
    }

    private async Task<AdminResult<AdminProductImagesDto>> NotFoundAsync(int productId, CancellationToken cancellationToken) =>
        AdminResult<AdminProductImagesDto>.NotFound(await db.Products.AnyAsync(p => p.Id == productId, cancellationToken) ? ImageNotFound : ProductNotFound);

    private async Task<AdminProductImagesDto> ImagesOfAsync(int productId, CancellationToken cancellationToken)
    {
        var images = await db.ProductImages.AsNoTracking().Where(i => i.ProductId == productId).OrderBy(i => i.SortOrder).ToListAsync(cancellationToken);
        var rowVersion = await db.Products.AsNoTracking().Where(p => p.Id == productId).Select(p => p.RowVersion).FirstAsync(cancellationToken);
        return new AdminProductImagesDto(images.Select(ToDto).ToList(), rowVersion);
    }
}
