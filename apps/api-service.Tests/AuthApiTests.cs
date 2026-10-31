using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sokko.Api.Data;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

internal sealed class CapturingEmailSender : IEmailSender
{
    private readonly Dictionary<string, string> _links = [];

    public string LinkFor(string email)
    {
        lock (_links)
        {
            return _links[email];
        }
    }

    public Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default)
    {
        lock (_links)
        {
            _links[email] = link;
        }
        return Task.CompletedTask;
    }
}

/// <summary>API real contra la BD de Development; el correo se captura y el límite se ajusta por prueba.</summary>
public class AuthApiFactory : WebApplicationFactory<Program>
{
    internal CapturingEmailSender Email { get; } = new();

    protected virtual string PermitLimit => "10000";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("RateLimiting:AuthPermitLimit", PermitLimit);
        builder.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<IEmailSender>(Email)));
    }
}

public sealed class LimitedAuthApiFactory : AuthApiFactory
{
    protected override string PermitLimit => "2";
}

public class AuthApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Aiko = "hola@sokko.mx";
    private const string AikoPassword = "Kyoto2026";
    private const string Daniel = "daniel@sokko.mx";
    private const string Nexus = "nexus@sokko.mx";
    private const string NexusPassword = "NexusCode2026";

    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private Task<HttpResponseMessage> Post(string url, object body) => _client.PostAsJsonAsync(url, body, Ct);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Ct);

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal((int)status, (await Json(response)).GetProperty("status").GetInt32());
    }

    private async Task<HttpResponseMessage> GetWithToken(string url, string? token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return await _client.SendAsync(request, Ct);
    }

    private async Task<string> TokenFor(string email, string password, string url = "/api/auth/login")
    {
        var response = await Post(url, new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await Json(response)).GetProperty("accessToken").GetString()!;
    }

    /// <summary>Cuenta desechable: el correo es único en cada corrida y al final se borra.</summary>
    private async Task<string> WithTempUser(Func<string, Task> test)
    {
        var email = $"prueba-{Guid.NewGuid():N}@sokko.test";
        try
        {
            var response = await Post("/api/auth/register", new
            {
                firstName = " Ana ", lastName = "Prueba", email = $"  {email.ToUpperInvariant()} ", password = "Clave2026", preferredSize = "L", marketingOptIn = true, acceptedTerms = true,
            });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            await test(email);
            return email;
        }
        finally
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            await db.Users.Where(u => u.Email == email).ExecuteDeleteAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task Store_login_returns_the_contract_and_accepts_the_owner()
    {
        var response = await Post("/api/auth/login", new { email = "  HOLA@sokko.mx ", password = AikoPassword });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync(Ct);
        var json = JsonDocument.Parse(body).RootElement;

        Assert.False(string.IsNullOrEmpty(json.GetProperty("accessToken").GetString()));
        Assert.Equal(7200, json.GetProperty("expiresIn").GetInt32());
        var user = json.GetProperty("user");
        Assert.Equal("Aiko", user.GetProperty("firstName").GetString());
        Assert.Equal("Morales", user.GetProperty("lastName").GetString());
        Assert.Equal(Aiko, user.GetProperty("email").GetString());
        Assert.Equal("M", user.GetProperty("preferredSize").GetString());
        Assert.True(user.GetProperty("marketingOptIn").GetBoolean());
        Assert.StartsWith("2026-03-21", user.GetProperty("memberSince").GetString());
        Assert.DoesNotContain("password", body, StringComparison.OrdinalIgnoreCase);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        Assert.NotNull(await db.Users.Where(u => u.Email == Aiko).Select(u => u.LastLoginAt).SingleAsync(Ct));
    }

    [Fact]
    public async Task Demo_accounts_log_in_to_the_store()
    {
        Assert.False(string.IsNullOrEmpty(await TokenFor(Nexus, NexusPassword)));
        Assert.False(string.IsNullOrEmpty(await TokenFor(Daniel, "Operaciones2026")));
    }

    [Fact]
    public async Task Wrong_email_and_wrong_password_get_the_same_401()
    {
        var wrongPassword = await Post("/api/auth/login", new { email = Aiko, password = "Equivocada1" });
        var wrongEmail = await Post("/api/auth/login", new { email = "nadie@sokko.mx", password = "Equivocada1" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrongEmail.StatusCode);
        Assert.Equal("application/problem+json", wrongEmail.Content.Headers.ContentType?.MediaType);
        Assert.Equal((await Json(wrongPassword)).GetProperty("title").GetString(), (await Json(wrongEmail)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Inactive_user_cannot_log_in()
    {
        await WithTempUser(async email =>
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            var token = await TokenFor(email, "Clave2026");
            await db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(u => u.SetProperty(x => x.IsActive, false), Ct);

            await AssertProblem(await Post("/api/auth/login", new { email, password = "Clave2026" }), HttpStatusCode.Unauthorized);
            await AssertProblem(await GetWithToken("/api/auth/me", token), HttpStatusCode.Unauthorized);
        });
    }

    [Fact]
    public async Task Login_without_fields_returns_400()
    {
        await AssertProblem(await Post("/api/auth/login", new { email = Aiko }), HttpStatusCode.BadRequest);
        await AssertProblem(await Post("/api/admin/auth/login", new { password = "x" }), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_normalizes_the_email_returns_201_and_rejects_duplicates_with_409()
    {
        await WithTempUser(async email =>
        {
            var token = await TokenFor(email, "Clave2026");
            var me = await Json(await GetWithToken("/api/auth/me", token));
            var user = me.GetProperty("user");
            Assert.Equal(email, user.GetProperty("email").GetString());
            Assert.Equal("Ana", user.GetProperty("firstName").GetString());
            Assert.Equal("L", user.GetProperty("preferredSize").GetString());

            var duplicate = await Post("/api/auth/register", new
            {
                firstName = "A", lastName = "B", email = email.ToUpperInvariant(), password = "Clave2026", acceptedTerms = true,
            });
            await AssertProblem(duplicate, HttpStatusCode.Conflict);
        });
    }

    [Theory]
    [InlineData("", "B", "nuevo@sokko.test", "Clave2026", true, "FirstName")]
    [InlineData("A", "", "nuevo@sokko.test", "Clave2026", true, "LastName")]
    [InlineData("A", "B", "sin-arroba", "Clave2026", true, "Email")]
    [InlineData("A", "B", "nuevo@sokko.test", "debil", true, "Password")]
    [InlineData("A", "B", "nuevo@sokko.test", "sinnumeroS", true, "Password")]
    [InlineData("A", "B", "nuevo@sokko.test", "Clave2026", false, "AcceptedTerms")]
    public async Task Register_validates_each_field(string firstName, string lastName, string email, string password, bool acceptedTerms, string field)
    {
        var response = await Post("/api/auth/register", new { firstName, lastName, email, password, acceptedTerms });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Me_requires_a_valid_bearer()
    {
        await AssertProblem(await GetWithToken("/api/auth/me", null), HttpStatusCode.Unauthorized);
        await AssertProblem(await GetWithToken("/api/auth/me", "no-es-un-token"), HttpStatusCode.Unauthorized);

        var me = await GetWithToken("/api/auth/me", await TokenFor(Nexus, NexusPassword));
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(Nexus, (await Json(me)).GetProperty("user").GetProperty("email").GetString());
    }

    [Theory]
    [InlineData(Aiko)]
    [InlineData("nadie@sokko.mx")]
    [InlineData("no-es-correo")]
    public async Task Forgot_password_is_always_202_with_no_body(string email)
    {
        var response = await Post("/api/auth/forgot-password", new { email });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Reset_changes_the_password_once_and_invalidates_previous_links()
    {
        await WithTempUser(async email =>
        {
            await Post("/api/auth/forgot-password", new { email });
            var first = TokenOf(factory.Email.LinkFor(email));
            await Post("/api/auth/forgot-password", new { email });
            var second = TokenOf(factory.Email.LinkFor(email));
            Assert.NotEqual(first, second);

            // El enlace anterior ya no sirve.
            await AssertProblem(await Post("/api/auth/reset-password", new { token = first, newPassword = "Nueva2026" }), HttpStatusCode.BadRequest);

            var done = await Post("/api/auth/reset-password", new { token = second, newPassword = "Nueva2026" });
            Assert.Equal(HttpStatusCode.NoContent, done.StatusCode);

            // Un solo uso, y la contraseña anterior deja de funcionar.
            await AssertProblem(await Post("/api/auth/reset-password", new { token = second, newPassword = "Otra20266" }), HttpStatusCode.BadRequest);
            await AssertProblem(await Post("/api/auth/login", new { email, password = "Clave2026" }), HttpStatusCode.Unauthorized);
            Assert.False(string.IsNullOrEmpty(await TokenFor(email, "Nueva2026")));
        });
    }

    [Fact]
    public async Task Reset_rejects_expired_tokens_and_weak_passwords()
    {
        await WithTempUser(async email =>
        {
            await Post("/api/auth/forgot-password", new { email });
            var token = TokenOf(factory.Email.LinkFor(email));
            await AssertProblem(await Post("/api/auth/reset-password", new { token, newPassword = "debil" }), HttpStatusCode.BadRequest);

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            // Vence sin romper CK_PasswordResetTokens_Expiry (ExpiresAt > CreatedAt).
            await db.PasswordResetTokens.Where(t => t.User.Email == email).ExecuteUpdateAsync(u => u
                .SetProperty(t => t.CreatedAt, DateTime.UtcNow.AddHours(-2))
                .SetProperty(t => t.ExpiresAt, DateTime.UtcNow.AddHours(-1)), Ct);

            await AssertProblem(await Post("/api/auth/reset-password", new { token, newPassword = "Nueva2026" }), HttpStatusCode.BadRequest);
        });
    }

    [Fact]
    public async Task Reset_token_is_not_stored_in_clear()
    {
        await WithTempUser(async email =>
        {
            await Post("/api/auth/forgot-password", new { email });
            var token = TokenOf(factory.Email.LinkFor(email));

            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            var row = await db.PasswordResetTokens.AsNoTracking().SingleAsync(t => t.User.Email == email, Ct);
            Assert.Equal(32, row.TokenHash.Length);
            Assert.Equal(scope.ServiceProvider.GetRequiredService<IAuthService>().HashResetToken(token), row.TokenHash);
            Assert.Equal(TimeSpan.FromMinutes(30), row.ExpiresAt - row.CreatedAt);
        });
    }

    private static string TokenOf(string link) => Uri.UnescapeDataString(link[(link.IndexOf("token=", StringComparison.Ordinal) + 6)..]);

    [Theory]
    [InlineData(Aiko, AikoPassword, "dueno", "Aiko Morales")]
    [InlineData(Daniel, "Operaciones2026", "operaciones", "Daniel Ruiz")]
    public async Task Panel_login_returns_staff_with_panel_role_codes(string email, string password, string role, string name)
    {
        var response = await Post("/api/admin/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await Json(response);
        var user = json.GetProperty("user");
        Assert.Equal(role, user.GetProperty("role").GetString());
        Assert.Equal(name, user.GetProperty("name").GetString());

        var me = await GetWithToken("/api/admin/auth/me", json.GetProperty("accessToken").GetString());
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(role, (await Json(me)).GetProperty("user").GetProperty("role").GetString());
    }

    [Fact]
    public async Task Panel_rejects_a_customer_with_403_and_bad_credentials_with_401()
    {
        await AssertProblem(await Post("/api/admin/auth/login", new { email = Nexus, password = NexusPassword }), HttpStatusCode.Forbidden);
        await AssertProblem(await Post("/api/admin/auth/login", new { email = Nexus, password = "Equivocada1" }), HttpStatusCode.Unauthorized);

        var storeToken = await TokenFor(Nexus, NexusPassword);
        await AssertProblem(await GetWithToken("/api/admin/auth/me", storeToken), HttpStatusCode.Forbidden);
        await AssertProblem(await GetWithToken("/api/admin/auth/me", null), HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("Owner", "costs.view", true)]
    [InlineData("Owner", "catalog.edit", true)]
    [InlineData("Operations", "catalog.view", true)]
    [InlineData("Operations", "catalog.edit", false)]
    [InlineData("Operations", "costs.view", false)]
    [InlineData("Customer", "catalog.view", false)]
    [InlineData("Customer", "staff", false)]
    public async Task Policies_follow_the_panel_permissions(string role, string policy, bool allowed)
    {
        using var scope = factory.Services.CreateScope();
        var authorization = scope.ServiceProvider.GetRequiredService<IAuthorizationService>();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("role", role)], "test", "sub", "role"));

        Assert.Equal(allowed, (await authorization.AuthorizeAsync(principal, policy)).Succeeded);
    }
}

public class AuthRateLimitTests(LimitedAuthApiFactory factory) : IClassFixture<LimitedAuthApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/register")]
    [InlineData("/api/auth/forgot-password")]
    [InlineData("/api/auth/reset-password")]
    [InlineData("/api/admin/auth/login")]
    public async Task Third_request_in_the_window_returns_429_with_problem_details(string url)
    {
        var client = factory.CreateClient();
        var body = new { email = "nadie@sokko.mx", password = "Equivocada1", token = "x", newPassword = "Nueva2026", firstName = "" };

        await client.PostAsJsonAsync(url, body, Ct);
        await client.PostAsJsonAsync(url, body, Ct);
        var limited = await client.PostAsJsonAsync(url, body, Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("application/problem+json", limited.Content.Headers.ContentType?.MediaType);
        Assert.True(limited.Headers.Contains("Retry-After"));
    }
}
