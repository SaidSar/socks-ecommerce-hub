using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public sealed class AdminApiFactory : WebApplicationFactory<Program>
{
    internal CapturingEmailSender Email { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("RateLimiting:AuthPermitLimit", "10000");
        builder.UseSetting("Orders:OxxoExpiryJobEnabled", "false");
        builder.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<IEmailSender>(Email)));
    }
}

/// <summary>Llamadas a la API como cada rol, con las cuentas demo.</summary>
public abstract class AdminApiTestBase(AdminApiFactory factory)
{
    protected const string Owner = "owner";
    protected const string Operations = "operations";
    protected const string Customer = "customer";

    private static readonly Dictionary<string, (string Email, string Password)> Accounts = new()
    {
        [Owner] = ("hola@sokko.mx", "Kyoto2026"),
        [Operations] = ("daniel@sokko.mx", "Operaciones2026"),
        [Customer] = ("nexus@sokko.mx", "NexusCode2026"),
    };

    private readonly Dictionary<string, string> _tokens = [];

    protected AdminApiFactory Factory { get; } = factory;

    protected HttpClient Client { get; } = factory.CreateClient();

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<string> TokenOf(string role)
    {
        if (!_tokens.TryGetValue(role, out var token))
        {
            var (email, password) = Accounts[role];
            var response = await Client.PostAsJsonAsync("/api/auth/login", new { email, password }, Ct);
            token = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("accessToken").GetString()!;
            _tokens[role] = token;
        }
        return token;
    }

    protected async Task<HttpResponseMessage> Send(HttpMethod method, string url, string? role, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (role is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await TokenOf(role));
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return await Client.SendAsync(request, Ct);
    }

    protected Task<HttpResponseMessage> Get(string url, string? role) => Send(HttpMethod.Get, url, role);

    protected Task<HttpResponseMessage> Post(string url, string? role, object body) => Send(HttpMethod.Post, url, role, body);

    protected Task<HttpResponseMessage> Put(string url, string? role, object body) => Send(HttpMethod.Put, url, role, body);

    protected static async Task<JsonElement> Json(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
}
