using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Azure;
using Azure.Communication.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>La API como corre detrás de App Service: ambiente Production, sin la configuración de Development.</summary>
public class ProductionApiFactory : WebApplicationFactory<Program>
{
    public virtual Dictionary<string, string?> Settings => new()
    {
        ["ConnectionStrings:Sokko"] = Environment.GetEnvironmentVariable("ConnectionStrings__Sokko") ?? "Server=localhost;Database=Sokko;Trusted_Connection=True;TrustServerCertificate=True",
        ["Jwt:SigningKey"] = new string('k', 64),
        ["Frontend:WebStoreUrl"] = "https://tienda.example.com/",
        ["Frontend:AdminPanelUrl"] = "https://panel.example.com, https://panel2.example.com",
        ["Email:Provider"] = EmailSetup.AzureProvider,
        ["Email:ConnectionString"] = "endpoint=https://prueba.communication.azure.com/;accesskey=a2V5",
        ["Email:SenderAddress"] = "DoNotReply@prueba.azurecomm.net",
        ["Payments:DemoMode"] = "true",
        ["Orders:OxxoExpiryJobEnabled"] = "false",
        ["RateLimiting:AuthPermitLimit"] = "2",
    };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(Settings));
    }
}

public class ProductionReadinessTests(ProductionApiFactory factory) : IClassFixture<ProductionApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Client() => factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    private async Task<HttpResponseMessage> Login(HttpClient client, string forwardedFor)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { email = "nadie@correo.test", password = "NoExiste2026" }) };
        request.Headers.Add("X-Forwarded-For", forwardedFor);
        return await client.SendAsync(request, Ct);
    }

    [Fact]
    public async Task Rate_limit_counts_the_real_client_behind_the_proxy()
    {
        var client = Client();
        var ip = $"203.0.113.{Random.Shared.Next(1, 120)}";

        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await Login(client, ip)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await Login(client, ip)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await Login(client, ip)).StatusCode);

        // Otro cliente detrás del mismo proxy tiene su propio límite.
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await Login(client, $"203.0.113.{Random.Shared.Next(121, 250)}")).StatusCode);
    }

    [Fact]
    public async Task Client_cannot_dodge_the_limit_by_forging_the_header()
    {
        var client = Client();
        // App Service agrega la IP real al final: lo que escribe el cliente va a la izquierda y no cuenta.
        const string real = "198.51.100.7";

        await Login(client, $"1.1.1.1, {real}");
        await Login(client, $"2.2.2.2, {real}");

        Assert.Equal(HttpStatusCode.TooManyRequests, (await Login(client, $"3.3.3.3, {real}")).StatusCode);
    }

    [Theory]
    [InlineData("https://tienda.example.com", true)]
    [InlineData("https://panel.example.com", true)]
    [InlineData("https://panel2.example.com", true)]
    [InlineData("https://ajeno.example.com", false)]
    [InlineData("http://tienda.example.com", false)]
    [InlineData("http://localhost:5173", false)]
    public async Task Cors_allows_only_the_configured_frontends(string origin, bool allowed)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/orders");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await Client().SendAsync(request, Ct);

        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed)
        {
            Assert.Equal(origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        }
    }

    [Theory]
    [InlineData("/swagger/index.html")]
    [InlineData("/openapi/v1.json")]
    public async Task Swagger_does_not_exist_in_production(string url) =>
        Assert.Equal(HttpStatusCode.NotFound, (await Client().GetAsync(url, Ct)).StatusCode);

    [Fact]
    public async Task Config_tells_the_store_about_demo_mode() =>
        Assert.True((await (await Client().GetAsync("/api/config", Ct)).Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("paymentsDemoMode").GetBoolean());

    [Fact]
    public void Production_uses_azure_for_email() =>
        Assert.IsType<AzureCommunicationEmailSender>(factory.Services.GetRequiredService<IEmailSender>());

    [Fact]
    public void Links_use_the_main_store_url() =>
        Assert.Equal("https://tienda.example.com", factory.Services.GetRequiredService<ResetLinkOptions>().WebStoreUrl);
}

public class FrontendUrlsTests
{
    [Theory]
    [InlineData("*")]
    [InlineData("https://*.example.com")]
    [InlineData("tienda.example.com")]
    [InlineData("ftp://tienda.example.com")]
    public void Wildcards_and_bad_urls_stop_the_app(string value) =>
        Assert.Throws<InvalidOperationException>(() => FrontendUrls.Parse(value));

    [Fact]
    public void Several_urls_are_split_and_reduced_to_their_origin() =>
        Assert.Equal(["https://a.example.com", "http://localhost:5173"], FrontendUrls.Parse(" https://a.example.com/ruta/ , http://localhost:5173 "));

    [Fact]
    public void Missing_frontends_stop_the_app() =>
        Assert.Throws<InvalidOperationException>(() => FrontendUrls.CorsOrigins(new ConfigurationBuilder().Build()));
}

public class HealthApiTests
{
    private sealed class UnhealthyFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("Orders:OxxoExpiryJobEnabled", "false");
            builder.ConfigureTestServices(services => services.AddHealthChecks().AddCheck("bd-caida", () => HealthCheckResult.Unhealthy("detalle interno")));
        }
    }

    private sealed class HealthyFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("Orders:OxxoExpiryJobEnabled", "false");
        }
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Health_checks_the_database()
    {
        await using var factory = new HealthyFactory();
        var response = await factory.CreateClient().GetAsync("/api/health", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("OK", (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Failed_check_gets_503_without_details_and_live_stays_up()
    {
        await using var factory = new UnhealthyFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("detalle interno", await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health/live", Ct)).StatusCode);
    }
}

public class EmailTests
{
    private static OrderConfirmationEmail Order(string? reference = null, DateTime? expires = null) => new(
        "ana@correo.test", "Ana <b>", "SKK-2000", 519m, reference, expires,
        [new OrderEmailLine("Tabi <i>", "Tinta Sumi", "M", 1, 420m)]);

    private sealed class SpyClient : EmailClient
    {
        public EmailMessage? Sent { get; private set; }

        public override Task<EmailSendOperation> SendAsync(WaitUntil wait, EmailMessage message, CancellationToken cancellationToken = default)
        {
            Sent = message;
            return Task.FromResult<EmailSendOperation>(null!);
        }
    }

    [Fact]
    public async Task Azure_sender_uses_the_templates_and_the_configured_sender()
    {
        var client = new SpyClient();
        await new AzureCommunicationEmailSender(client, "DoNotReply@sokko.test").SendOrderConfirmationAsync(Order(), Ct);

        Assert.Equal("DoNotReply@sokko.test", client.Sent!.SenderAddress);
        Assert.Equal("ana@correo.test", client.Sent.Recipients.To.Single().Address);
        Assert.Equal("Pedido SKK-2000 confirmado", client.Sent.Content.Subject);
        Assert.Contains("SKK-2000", client.Sent.Content.PlainText);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public void Card_confirmation_says_it_was_paid_and_escapes_what_the_customer_wrote()
    {
        var mail = EmailTemplates.OrderConfirmation(Order());

        Assert.Contains("pago con tarjeta se registró", mail.Html);
        Assert.DoesNotContain("<b>Ana", mail.Html);
        Assert.Contains("Ana &lt;b&gt;", mail.Html);
        Assert.Contains("Tabi &lt;i&gt;", mail.Html);
        Assert.DoesNotContain("Referencia", mail.Text);
    }

    [Fact]
    public void Oxxo_confirmation_has_the_reference_and_the_limit_in_local_time()
    {
        var mail = EmailTemplates.OrderConfirmation(Order("93123456789012", new DateTime(2026, 11, 2, 19, 0, 0, DateTimeKind.Utc)));

        Assert.Contains("93123456789012", mail.Html);
        Assert.Contains("93123456789012", mail.Text);
        Assert.Contains("2 de noviembre, 12:00", mail.Text);
    }

    [Fact]
    public void Reset_and_invitation_are_in_spanish_with_their_link()
    {
        var reset = EmailTemplates.PasswordReset("https://t.test/r?token=a&b=1");
        Assert.Contains("Restablezca", reset.Subject);
        Assert.Contains("https://t.test/r?token=a&amp;b=1", reset.Html);
        Assert.Contains("https://t.test/r?token=a&b=1", reset.Text);
        Assert.Contains("panel", EmailTemplates.Invitation("https://t.test/i").Subject);
    }

    [Fact]
    public void Log_is_not_allowed_outside_development()
    {
        var services = new ServiceCollection().AddLogging().BuildServiceProvider();
        IConfiguration Config(string? provider) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Email:Provider"] = provider }).Build();

        Assert.IsType<LogEmailSender>(EmailSetup.Create(services, Config(null), isDevelopment: true));
        Assert.Throws<InvalidOperationException>(() => EmailSetup.Create(services, Config("Log"), isDevelopment: false));
        Assert.Throws<InvalidOperationException>(() => EmailSetup.Create(services, Config(null), isDevelopment: false));
        Assert.Throws<InvalidOperationException>(() => EmailSetup.Create(services, Config("Azure"), isDevelopment: false));
    }

    private sealed class FailingEmail : IEmailSender
    {
        public Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default) => throw new InvalidOperationException();
        public Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default) => throw new InvalidOperationException();
        public Task SendOrderConfirmationAsync(OrderConfirmationEmail order, CancellationToken cancellationToken = default) => throw new InvalidOperationException("servicio caído");
    }

    private sealed class ListLogger<T> : ILogger<T>
    {
        public List<LogLevel> Levels { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Levels.Add(logLevel);
    }

    [Fact]
    public async Task Failed_email_is_logged_and_does_not_break_the_purchase()
    {
        var logger = new ListLogger<OrderConfirmation>();
        var order = new Order { CustomerEmail = "a@b.test", CustomerFirstName = "Ana", PaymentMethod = PaymentMethod.Tarjeta, PaymentStatus = PaymentStatus.Pagado };
        var confirmation = new OrderConfirmation(new SingleOrderService(order), new FailingEmail(), new FixedExpiry(), logger);

        await confirmation.SendAsync("SKK-1");

        Assert.Equal([LogLevel.Error], logger.Levels);
    }

    private sealed class FixedExpiry : IExpireOxxoOrders
    {
        public TimeSpan Lifetime => TimeSpan.FromHours(72);
        public Task<int> RunAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
    }
}

/// <summary>Solo responde <see cref="FindByFolioAsync"/>; lo demás no se usa en estas pruebas.</summary>
internal sealed class SingleOrderService(Order order) : IOrderService
{
    public Task<Order?> FindByFolioAsync(string folio, CancellationToken cancellationToken = default) => Task.FromResult<Order?>(order);
    public Task<bool> CreateAsync(Order o, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task RecordPaymentAsync(Order o, string reference, bool paid, DateTime at, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<Order?> FindByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<IReadOnlyList<Order>> ListByUserAsync(int userId, int limit, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<IReadOnlyList<int>> ListExpiredOxxoAsync(DateTime cutoff, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<IReadOnlyList<StockLine>?> CancelUnpaidOxxoAsync(int orderId, string note, DateTime at, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    public Task<bool> ConfirmOxxoPaymentAsync(string folio, DateTime at, CancellationToken cancellationToken = default) => throw new NotSupportedException();
}
