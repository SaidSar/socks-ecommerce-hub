using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Sokko.Api.Services;

/// <summary>Servicio de utilidad: guarda y borra las fotos de producto. Devuelve la URL pública con la que se muestran.</summary>
public interface IImageStorage
{
    /// <summary><c>false</c> si no hay dónde guardar fotos: subir y borrar responden 503; mostrar las ya guardadas sigue igual.</summary>
    bool IsConfigured => true;

    Task<string> UploadAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default);

    /// <summary>No falla si ya no existe.</summary>
    Task DeleteAsync(string blobName, CancellationToken cancellationToken = default);
}

/// <summary>
/// Producción: un contenedor de Azure Blob con lectura pública de blobs. La API entra con su identidad administrada
/// (rol Storage Blob Data Contributor sobre la cuenta, <c>infra/storage.bicep</c>): no hay claves ni cadenas de conexión.
/// </summary>
public class AzureBlobImageStorage(BlobContainerClient container) : IImageStorage
{
    // Cada subida tiene un nombre nuevo, así que la URL nunca cambia de contenido.
    private const string CacheControl = "public, max-age=31536000, immutable";

    public async Task<string> UploadAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var blob = container.GetBlobClient(blobName);
        await blob.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType, CacheControl = CacheControl },
            Conditions = new BlobRequestConditions { IfNoneMatch = Azure.ETag.All },
        }, cancellationToken);
        return blob.Uri.ToString();
    }

    public Task DeleteAsync(string blobName, CancellationToken cancellationToken = default) =>
        container.GetBlobClient(blobName).DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: cancellationToken);
}

/// <summary>
/// Producción sin <c>Images:BlobServiceUrl</c>: la API arranca igual. Las fotos ya guardadas son URLs públicas y la tienda las sigue
/// mostrando; solo subir y borrar quedan fuera de servicio. Nadie debe llamar a estos métodos: el servicio revisa
/// <see cref="IsConfigured"/> antes.
/// </summary>
public class UnconfiguredImageStorage : IImageStorage
{
    public const string Message = "Almacenamiento de imágenes no configurado.";

    public bool IsConfigured => false;

    public Task<string> UploadAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException(Message);

    public Task DeleteAsync(string blobName, CancellationToken cancellationToken = default) => throw new InvalidOperationException(Message);
}

/// <summary>Development: las fotos van a <c>wwwroot/uploads</c> y las sirve la propia API.</summary>
public class LocalImageStorage(string rootPath, Uri publicBaseUrl) : IImageStorage
{
    public const string Folder = "uploads";

    /// <summary>Crea la carpeta si no existe y la devuelve, para servirla como archivos estáticos.</summary>
    public string EnsureRoot() => Directory.CreateDirectory(Path.GetFullPath(Path.Combine(rootPath, Folder))).FullName;

    public async Task<string> UploadAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var path = PathOf(blobName);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using (var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write))
        {
            await content.CopyToAsync(file, cancellationToken);
        }
        return new Uri(publicBaseUrl, $"{Folder}/{blobName}").ToString();
    }

    public Task DeleteAsync(string blobName, CancellationToken cancellationToken = default)
    {
        File.Delete(PathOf(blobName));
        return Task.CompletedTask;
    }

    /// <summary>El nombre lo arma el servicio, pero igual se comprueba que no salga de la carpeta.</summary>
    private string PathOf(string blobName)
    {
        var root = Path.GetFullPath(Path.Combine(rootPath, Folder));
        var path = Path.GetFullPath(Path.Combine(root, blobName));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new ArgumentException("Nombre de imagen no válido.", nameof(blobName));
        }
        return path;
    }
}

public static class ImageStorageSetup
{
    public const string DefaultContainer = "product-images";

    /// <summary>
    /// Con <c>Images:BlobServiceUrl</c> (la URL de la cuenta, <c>https://&lt;cuenta&gt;.blob.core.windows.net</c>) usa Azure Blob.
    /// Sin ella: en Development, la carpeta local; en los demás ambientes, <see cref="UnconfiguredImageStorage"/>, y la API arranca igual.
    /// </summary>
    public static IImageStorage Create(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var serviceUrl = configuration["Images:BlobServiceUrl"];
        var containerName = configuration["Images:Container"] ?? DefaultContainer;
        if (!string.IsNullOrWhiteSpace(serviceUrl))
        {
            var containerUri = new Uri(new Uri(serviceUrl.TrimEnd('/') + "/"), containerName);
            return new AzureBlobImageStorage(new BlobContainerClient(containerUri, new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned)));
        }
        if (environment.IsDevelopment())
        {
            var baseUrl = configuration["Images:LocalBaseUrl"] ?? "http://localhost:5080/";
            return new LocalImageStorage(Path.Combine(environment.ContentRootPath, "wwwroot"), new Uri(baseUrl.TrimEnd('/') + "/"));
        }
        return new UnconfiguredImageStorage();
    }
}
