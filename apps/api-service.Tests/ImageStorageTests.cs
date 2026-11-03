using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class ImageStorageTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class FakeEnvironment(string name, string contentRoot) : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Sokko.Api";
        public string ContentRootPath { get; set; } = contentRoot;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = null!;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    [Theory]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xDB }, ".jpg", "image/jpeg")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, ".png", "image/png")]
    [InlineData(new byte[] { 0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50 }, ".webp", "image/webp")]
    public void Detects_the_three_formats_by_their_signature(byte[] header, string extension, string contentType)
    {
        var format = ImageFormat.Detect(header);
        Assert.Equal(extension, format?.Extension);
        Assert.Equal(contentType, format?.ContentType);
    }

    [Theory]
    [InlineData(new byte[] { })]
    [InlineData(new byte[] { 0xFF, 0xD8 })]
    [InlineData(new byte[] { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 })] // GIF
    [InlineData(new byte[] { 0x3C, 0x73, 0x76, 0x67 })] // <svg
    [InlineData(new byte[] { 0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45 })] // RIFF WAVE
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47 })] // PNG cortado
    public void Anything_else_is_not_a_photo(byte[] header) => Assert.Null(ImageFormat.Detect(header));

    [Fact]
    public async Task Local_storage_writes_under_uploads_and_returns_an_absolute_url()
    {
        var root = Directory.CreateTempSubdirectory("sokko-fotos").FullName;
        try
        {
            var storage = new LocalImageStorage(root, new Uri("http://localhost:5080/"));
            var url = await storage.UploadAsync("products/7/abc.webp", new MemoryStream([1, 2, 3]), "image/webp", Ct);

            Assert.Equal("http://localhost:5080/uploads/products/7/abc.webp", url);
            var path = Path.Combine(root, "uploads", "products", "7", "abc.webp");
            Assert.Equal([1, 2, 3], await File.ReadAllBytesAsync(path, Ct));

            await storage.DeleteAsync("products/7/abc.webp", Ct);
            Assert.False(File.Exists(path));
            await storage.DeleteAsync("products/7/abc.webp", Ct);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Theory]
    [InlineData("../fuera.webp")]
    [InlineData("products/../../fuera.webp")]
    public async Task Local_storage_never_writes_outside_its_folder(string blobName)
    {
        var storage = new LocalImageStorage(Path.GetTempPath(), new Uri("http://localhost:5080/"));
        await Assert.ThrowsAsync<ArgumentException>(() => storage.UploadAsync(blobName, new MemoryStream([1]), "image/webp", Ct));
    }

    [Fact]
    public void With_the_account_url_it_uses_azure_blob_in_any_environment()
    {
        var storage = ImageStorageSetup.Create(Config(("Images:BlobServiceUrl", "https://stprueba.blob.core.windows.net")), new FakeEnvironment(Environments.Production, Path.GetTempPath()));
        Assert.IsType<AzureBlobImageStorage>(storage);
    }

    [Fact]
    public void Without_it_development_uses_the_local_folder_and_production_starts_without_storage()
    {
        var local = ImageStorageSetup.Create(Config(), new FakeEnvironment(Environments.Development, Path.GetTempPath()));
        Assert.IsType<LocalImageStorage>(local);
        Assert.True(local.IsConfigured);

        var production = ImageStorageSetup.Create(Config(("Images:BlobServiceUrl", "  ")), new FakeEnvironment(Environments.Production, Path.GetTempPath()));
        Assert.IsType<UnconfiguredImageStorage>(production);
        Assert.False(production.IsConfigured);
    }
}
