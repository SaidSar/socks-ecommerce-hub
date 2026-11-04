using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;

namespace Sokko.Api.Tests;

/// <summary>API real contra la BD de Development, sin el límite de 5 mensajes por hora.</summary>
public class ContactApiFactory : AuthApiFactory
{
    protected virtual string ContactPermitLimit => "10000";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("RateLimiting:ContactPermitLimit", ContactPermitLimit);
    }
}

/// <summary>El límite de producción: 5 por IP por hora.</summary>
public sealed class LimitedContactApiFactory : ContactApiFactory
{
    protected override string ContactPermitLimit => "5";
}

public class ContactApiTests(ContactApiFactory factory) : IClassFixture<ContactApiFactory>
{
    private const string StoreEmail = "tienda@sokko.test";

    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static object Body(string email, string? website = null) => new
    {
        name = " Ana Prueba ",
        email = $" {email.ToUpperInvariant()} ",
        subject = "Un pedido",
        message = "¿Cuándo llega mi pedido SKK-1001?",
        website,
    };

    /// <summary>Correo único por prueba; al final borra sus mensajes y regresa el correo de la tienda a como estaba.</summary>
    private async Task WithContactEmail(string? storeEmail, Func<string, Task> test)
    {
        var email = $"contacto-{Guid.NewGuid():N}@sokko.test";
        string? previous;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            previous = await db.Settings.Select(s => s.ContactEmail).SingleAsync(Ct);
            await db.Settings.ExecuteUpdateAsync(s => s.SetProperty(x => x.ContactEmail, storeEmail), Ct);
        }
        try
        {
            await test(email);
        }
        finally
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            await db.ContactMessages.Where(m => m.Email == email).ExecuteDeleteAsync(CancellationToken.None);
            await db.Settings.ExecuteUpdateAsync(s => s.SetProperty(x => x.ContactEmail, previous), CancellationToken.None);
            factory.Email.FailContact = false;
        }
    }

    private async Task<List<Models.ContactMessage>> SavedFor(string email)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        return await db.ContactMessages.AsNoTracking().Where(m => m.Email == email).ToListAsync(Ct);
    }

    [Fact]
    public async Task Valid_message_is_saved_normalized_and_the_store_is_notified()
    {
        await WithContactEmail(StoreEmail, async email =>
        {
            var response = await _client.PostAsJsonAsync("/api/contact", Body(email), Ct);

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            var saved = Assert.Single(await SavedFor(email));
            Assert.Equal("Ana Prueba", saved.Name);
            Assert.Equal("Un pedido", saved.Subject);
            Assert.NotNull(saved.NotifiedAt);
            var sent = Assert.Single(factory.Email.Contacts, c => c.Email == email);
            Assert.Equal(StoreEmail, sent.To);
        });
    }

    [Fact]
    public async Task Without_a_store_email_the_message_is_only_saved()
    {
        await WithContactEmail(null, async email =>
        {
            var response = await _client.PostAsJsonAsync("/api/contact", Body(email), Ct);

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Null(Assert.Single(await SavedFor(email)).NotifiedAt);
            Assert.DoesNotContain(factory.Email.Contacts, c => c.Email == email);
        });
    }

    [Fact]
    public async Task Failed_email_still_saves_the_message_and_returns_202()
    {
        await WithContactEmail(StoreEmail, async email =>
        {
            factory.Email.FailContact = true;

            var response = await _client.PostAsJsonAsync("/api/contact", Body(email), Ct);

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Null(Assert.Single(await SavedFor(email)).NotifiedAt);
        });
    }

    [Fact]
    public async Task Filled_honeypot_returns_202_and_saves_nothing()
    {
        await WithContactEmail(StoreEmail, async email =>
        {
            var response = await _client.PostAsJsonAsync("/api/contact", Body(email, website: "https://spam.test"), Ct);

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.Empty(await SavedFor(email));
            Assert.DoesNotContain(factory.Email.Contacts, c => c.Email == email);
        });
    }

    [Fact]
    public async Task Invalid_message_returns_validation_problem_details_per_field()
    {
        var response = await _client.PostAsJsonAsync("/api/contact", new { name = "", email = "ana@", subject = "", message = "Hola" }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors");
        Assert.Equal(
            ["Email", "Message", "Name", "Subject"],
            errors.EnumerateObject().Select(e => e.Name).Order().ToArray());
    }
}

public class ContactRateLimitTests(LimitedContactApiFactory factory) : IClassFixture<LimitedContactApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Sixth_message_in_the_hour_returns_429_with_problem_details()
    {
        var client = factory.CreateClient();
        // Cuerpos inválidos: cuentan para el límite sin escribir en la BD.
        var body = new { name = "", email = "", subject = "", message = "" };

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/contact", body, Ct)).StatusCode);
        }
        var limited = await client.PostAsJsonAsync("/api/contact", body, Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("application/problem+json", limited.Content.Headers.ContentType?.MediaType);
        Assert.True(limited.Headers.Contains("Retry-After"));
    }
}
