using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sokko.Api.Data;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class AdminProductImagesApiTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    private static readonly byte[] Webp = [.. "RIFF"u8, 0x24, 0, 0, 0, .. "WEBPVP8 "u8, 1, 2, 3, 4];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 16, .. "JFIF"u8, 0, 1];

    private readonly List<string> _slugs = [];

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.ProductImages.Where(i => _slugs.Contains(i.Product.Slug)).ExecuteDeleteAsync();
        await db.ProductVariants.Where(v => _slugs.Contains(v.Product.Slug)).ExecuteDeleteAsync();
        await db.Products.Where(p => _slugs.Contains(p.Slug)).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private async Task<JsonElement> NewProduct()
    {
        var name = $"Lentes Foto {Guid.NewGuid():N}"[..24];
        var response = await Post("/api/admin/products", Owner, new
        {
            line = "accesorios", name, material = "Prueba", brand = "sin-marca", type = "lentes", unitsPerPack = 1, price = 250m, unitCost = 100m, colors = new[] { "NEG" },
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var product = await Json(response);
        _slugs.Add(product.GetProperty("slug").GetString()!);
        return product;
    }

    private static MultipartFormDataContent Form(byte[] bytes, string fileName = "foto.webp", string contentType = "image/webp", string? altText = null)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        var form = new MultipartFormDataContent { { file, "file", fileName } };
        if (altText is not null)
        {
            form.Add(new StringContent(altText), "altText");
        }
        return form;
    }

    private Task<HttpResponseMessage> Upload(int productId, byte[] bytes, string? role = Owner, string? altText = null, string contentType = "image/webp") =>
        PostForm($"/api/admin/products/{productId}/images", role, Form(bytes, altText: altText, contentType: contentType));

    private async Task<JsonElement> UploadOk(int productId, byte[] bytes, string? altText = null)
    {
        var response = await Upload(productId, bytes, altText: altText);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Json(response);
    }

    private static List<int> Ids(JsonElement images) => images.GetProperty("images").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToList();

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string? field = null)
    {
        Assert.True(status == response.StatusCode, await response.Content.ReadAsStringAsync());
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        if (field is not null)
        {
            Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
        }
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.Forbidden)]
    public async Task Only_who_edits_products_manages_photos(string? role, HttpStatusCode expected)
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();

        Assert.Equal(expected, (await Upload(id, Webp, role)).StatusCode);
        Assert.Equal(expected, (await Put($"/api/admin/products/{id}/images/order", role, new { imageIds = Array.Empty<int>() })).StatusCode);
        Assert.Equal(expected, (await Put($"/api/admin/products/{id}/images/1", role, new { altText = "x" })).StatusCode);
        Assert.Equal(expected, (await Delete($"/api/admin/products/{id}/images/1", role)).StatusCode);
    }

    [Fact]
    public async Task Upload_detects_the_format_by_its_bytes_and_the_first_photo_is_the_cover()
    {
        var product = await NewProduct();
        var id = product.GetProperty("id").GetInt32();

        // El Content-Type del navegador no cuenta: lo que manda son los bytes.
        var first = await Json(await Upload(id, Png, altText: "  Lentes negros de frente  ", contentType: "image/webp"));
        var second = await UploadOk(id, Jpeg);

        var images = second.GetProperty("images").EnumerateArray().ToList();
        Assert.Equal(2, images.Count);
        Assert.Equal("Lentes negros de frente", images[0].GetProperty("altText").GetString());
        Assert.Equal([0, 1], images.Select(i => i.GetProperty("sortOrder").GetInt32()));
        var pngUrl = images[0].GetProperty("url").GetString()!;
        Assert.StartsWith($"{InMemoryImageStorage.BaseUrl}products/{id}/", pngUrl);
        Assert.EndsWith(".png", pngUrl);
        Assert.EndsWith(".jpg", images[1].GetProperty("url").GetString());
        Assert.Equal("image/png", Factory.Images.Blobs[pngUrl[InMemoryImageStorage.BaseUrl.Length..]].ContentType);

        // Cambia la portada, así que cambia el RowVersion; el panel lo usa para seguir editando sin un 409.
        Assert.NotEqual(product.GetProperty("rowVersion").GetString(), first.GetProperty("rowVersion").GetString());
        var edit = await Put($"/api/admin/products/{product.GetProperty("slug").GetString()}", Owner, new
        {
            name = product.GetProperty("name").GetString(), brand = "sin-marca", type = "lentes", price = 260m, unitCost = 100m, colors = new[] { "NEG" },
            rowVersion = second.GetProperty("rowVersion").GetString(),
        });
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
        Assert.Equal(2, (await Json(edit)).GetProperty("images").GetArrayLength());
    }

    [Fact]
    public async Task Store_receives_the_images_in_order_and_the_cover_as_imageUrl()
    {
        var product = await NewProduct();
        var id = product.GetProperty("id").GetInt32();
        var slug = product.GetProperty("slug").GetString();

        var before = await Json(await Get($"/api/products/{slug}", null));
        Assert.Equal(JsonValueKind.Null, before.GetProperty("imageUrl").ValueKind);
        Assert.Equal(0, before.GetProperty("images").GetArrayLength());

        await UploadOk(id, Webp, "Frente");
        var both = await UploadOk(id, Png, "Lado");
        var ids = Ids(both);
        await Put($"/api/admin/products/{id}/images/order", Owner, new { imageIds = new[] { ids[1], ids[0] } });

        var store = await Json(await Get($"/api/products/{slug}", null));
        var images = store.GetProperty("images").EnumerateArray().ToList();
        Assert.Equal(["Lado", "Frente"], images.Select(i => i.GetProperty("altText").GetString()));
        Assert.Equal(images[0].GetProperty("url").GetString(), store.GetProperty("imageUrl").GetString());
        // La tienda no recibe el id ni el nombre del archivo.
        Assert.Equal(["altText", "url"], images[0].EnumerateObject().Select(p => p.Name).Order());
    }

    [Fact]
    public async Task Rejects_what_is_not_a_photo_and_more_than_six()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();

        await AssertProblem(await Upload(id, "GIF89a.........."u8.ToArray(), contentType: "image/jpeg"), HttpStatusCode.BadRequest, "file");
        await AssertProblem(await Upload(id, []), HttpStatusCode.BadRequest, "file");
        await AssertProblem(await Upload(id, Webp, altText: new string('a', 201)), HttpStatusCode.BadRequest, "altText");
        await AssertProblem(await PostForm($"/api/admin/products/{id}/images", Owner, new MultipartFormDataContent { { new StringContent("x"), "altText" } }), HttpStatusCode.BadRequest, "file");

        for (var i = 0; i < ProductImageService.MaxImagesPerProduct; i++)
        {
            await UploadOk(id, Webp);
        }
        await AssertProblem(await Upload(id, Webp), HttpStatusCode.BadRequest, "file");
    }

    [Fact]
    public async Task Over_5_MB_is_413()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();
        var blobs = Factory.Images.Blobs.Count;

        var tooBig = new byte[ProductImageService.MaxBytes + 1];
        Webp.CopyTo(tooBig, 0);
        await AssertProblem(await Upload(id, tooBig), HttpStatusCode.RequestEntityTooLarge);
        await AssertProblem(await Upload(id, new byte[ProductImageService.MaxBytes * 2]), HttpStatusCode.RequestEntityTooLarge);
        Assert.Equal(blobs, Factory.Images.Blobs.Count);

        var exact = new byte[ProductImageService.MaxBytes];
        Webp.CopyTo(exact, 0);
        await UploadOk(id, exact);
    }

    [Fact]
    public async Task Missing_product_or_photo_is_404()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();
        var other = (await NewProduct()).GetProperty("id").GetInt32();
        var otherImage = Ids(await UploadOk(other, Webp))[0];

        await AssertProblem(await Upload(int.MaxValue, Webp), HttpStatusCode.NotFound);
        await AssertProblem(await Put($"/api/admin/products/{int.MaxValue}/images/order", Owner, new { imageIds = Array.Empty<int>() }), HttpStatusCode.NotFound);
        // Una foto de otro producto no se puede tocar desde este.
        await AssertProblem(await Delete($"/api/admin/products/{id}/images/{otherImage}", Owner), HttpStatusCode.NotFound);
        await AssertProblem(await Put($"/api/admin/products/{id}/images/{otherImage}", Owner, new { altText = "x" }), HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_removes_the_file_and_renumbers()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();
        await UploadOk(id, Webp);
        await UploadOk(id, Png);
        var all = await UploadOk(id, Jpeg);
        var ids = Ids(all);
        var firstBlob = all.GetProperty("images")[0].GetProperty("url").GetString()![InMemoryImageStorage.BaseUrl.Length..];

        var response = await Delete($"/api/admin/products/{id}/images/{ids[0]}", Owner);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var left = (await Json(response)).GetProperty("images").EnumerateArray().ToList();
        Assert.Equal([ids[1], ids[2]], left.Select(i => i.GetProperty("id").GetInt32()));
        Assert.Equal([0, 1], left.Select(i => i.GetProperty("sortOrder").GetInt32()));
        Assert.False(Factory.Images.Blobs.ContainsKey(firstBlob));

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        Assert.Equal(left[0].GetProperty("url").GetString(), await db.Products.Where(p => p.Id == id).Select(p => p.ImageUrl).SingleAsync(Ct));

        await Delete($"/api/admin/products/{id}/images/{ids[1]}", Owner);
        await Delete($"/api/admin/products/{id}/images/{ids[2]}", Owner);
        Assert.Null(await db.Products.Where(p => p.Id == id).Select(p => p.ImageUrl).SingleAsync(Ct));
    }

    [Fact]
    public async Task Order_needs_every_photo_once()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();
        await UploadOk(id, Webp);
        var ids = Ids(await UploadOk(id, Png));

        await AssertProblem(await Put($"/api/admin/products/{id}/images/order", Owner, new { imageIds = new[] { ids[0] } }), HttpStatusCode.BadRequest, "imageIds");
        await AssertProblem(await Put($"/api/admin/products/{id}/images/order", Owner, new { imageIds = new[] { ids[0], ids[0] } }), HttpStatusCode.BadRequest, "imageIds");
        await AssertProblem(await Put($"/api/admin/products/{id}/images/order", Owner, new { imageIds = new[] { ids[0], 0 } }), HttpStatusCode.BadRequest, "imageIds");

        var response = await Put($"/api/admin/products/{id}/images/order", Owner, new { imageIds = new[] { ids[1], ids[0] } });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal([ids[1], ids[0]], Ids(await Json(response)));
    }

    [Fact]
    public async Task Alt_text_is_trimmed_and_blank_clears_it()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();
        var imageId = Ids(await UploadOk(id, Webp, "Viejo"))[0];

        var set = await Json(await Put($"/api/admin/products/{id}/images/{imageId}", Owner, new { altText = "  Calceta en el pie  " }));
        Assert.Equal("Calceta en el pie", set.GetProperty("images")[0].GetProperty("altText").GetString());

        var cleared = await Json(await Put($"/api/admin/products/{id}/images/{imageId}", Owner, new { altText = "   " }));
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("images")[0].GetProperty("altText").ValueKind);

        await AssertProblem(await Put($"/api/admin/products/{id}/images/{imageId}", Owner, new { altText = new string('a', 201) }), HttpStatusCode.BadRequest, "AltText");
    }

    [Fact]
    public async Task If_the_storage_fails_no_row_is_left()
    {
        var id = (await NewProduct()).GetProperty("id").GetInt32();
        var blobs = Factory.Images.Blobs.Count;

        Factory.Images.NextFailure = new IOException("Sin conexión con el almacenamiento");
        Assert.Equal(HttpStatusCode.InternalServerError, (await Upload(id, Webp)).StatusCode);
        Assert.Equal(blobs, Factory.Images.Blobs.Count);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        Assert.False(await db.ProductImages.AnyAsync(i => i.ProductId == id, Ct));
    }

    [Fact]
    public async Task Without_storage_upload_and_delete_are_503_and_the_rest_keeps_working()
    {
        var product = await NewProduct();
        var id = product.GetProperty("id").GetInt32();
        var imageId = Ids(await UploadOk(id, Webp, "Ya guardada"))[0];

        // La misma API sin almacenamiento, como producción sin Images:BlobServiceUrl.
        await using var noStorage = Factory.WithWebHostBuilder(b =>
            b.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<IImageStorage>(new UnconfiguredImageStorage()))));
        var client = noStorage.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "hola@sokko.mx", password = "Kyoto2026" }, Ct);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await Json(login)).GetProperty("accessToken").GetString());

        async Task AssertUnavailable(HttpResponseMessage response)
        {
            await AssertProblem(response, HttpStatusCode.ServiceUnavailable);
            Assert.Equal("Almacenamiento de imágenes no configurado.", (await Json(response)).GetProperty("title").GetString());
        }

        await AssertUnavailable(await client.PostAsync($"/api/admin/products/{id}/images", Form(Webp), Ct));
        // También antes de validar: un archivo inválido o un producto que no existe no cambian la respuesta.
        await AssertUnavailable(await client.PostAsync($"/api/admin/products/{int.MaxValue}/images", Form([1, 2, 3]), Ct));
        await AssertUnavailable(await client.DeleteAsync($"/api/admin/products/{id}/images/{imageId}", Ct));

        // La foto que ya estaba sigue en la tienda; ordenar y el texto alternativo solo tocan la BD.
        var store = await Json(await client.GetAsync($"/api/products/{product.GetProperty("slug").GetString()}", Ct));
        Assert.Equal("Ya guardada", store.GetProperty("images")[0].GetProperty("altText").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/admin/products/{id}/images/{imageId}", new { altText = "Nuevo" }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/admin/products/{id}/images/order", new { imageIds = new[] { imageId } }, Ct)).StatusCode);
    }

    [Fact]
    public async Task Operations_sees_the_photos_read_only()
    {
        var product = await NewProduct();
        var id = product.GetProperty("id").GetInt32();
        await UploadOk(id, Webp, "Frente");

        var view = await Json(await Get($"/api/admin/products/{product.GetProperty("slug").GetString()}", Operations));
        Assert.Equal(id, view.GetProperty("id").GetInt32());
        Assert.Equal("Frente", view.GetProperty("images")[0].GetProperty("altText").GetString());
    }
}
