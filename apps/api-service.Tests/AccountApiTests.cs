using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Controllers;
using Sokko.Api.Data;

namespace Sokko.Api.Tests;

/// <summary>Mi perfil y cambio de contraseña, con cuentas desechables.</summary>
public class AccountApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Password = "Clave2026";

    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Ct);

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string? token, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return await _client.SendAsync(request, Ct);
    }

    private Task<HttpResponseMessage> Login(string email, string password) =>
        _client.PostAsJsonAsync("/api/auth/login", new { email, password }, Ct);

    /// <summary>Registra una cuenta, corre la prueba con su token y la borra al final.</summary>
    private async Task WithTempUser(Func<string, string, Task> test)
    {
        var email = $"perfil-{Guid.NewGuid():N}@sokko.test";
        try
        {
            var response = await _client.PostAsJsonAsync("/api/auth/register", new
            {
                firstName = "Ana", lastName = "Prueba", email, password = Password, preferredSize = "M", marketingOptIn = false, acceptedTerms = true,
            }, Ct);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            await test(email, (await Json(response)).GetProperty("accessToken").GetString()!);
        }
        finally
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            await db.Users.Where(u => u.Email == email).ExecuteDeleteAsync(CancellationToken.None);
        }
    }

    [Fact]
    public Task Update_profile_changes_name_size_and_newsletter_but_not_the_email() => WithTempUser(async (email, token) =>
    {
        var response = await Send(HttpMethod.Put, "/api/auth/me", token, new
        {
            firstName = "  Ana María ", lastName = "López", preferredSize = "L", marketingOptIn = true, email = "otro@sokko.test",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = (await Json(response)).GetProperty("user");
        Assert.Equal("Ana María", user.GetProperty("firstName").GetString());
        Assert.Equal("López", user.GetProperty("lastName").GetString());
        Assert.Equal("L", user.GetProperty("preferredSize").GetString());
        Assert.True(user.GetProperty("marketingOptIn").GetBoolean());
        Assert.Equal(email, user.GetProperty("email").GetString());

        var me = (await Json(await Send(HttpMethod.Get, "/api/auth/me", token))).GetProperty("user");
        Assert.Equal("Ana María", me.GetProperty("firstName").GetString());
        Assert.Equal(email, me.GetProperty("email").GetString());
    });

    [Fact]
    public Task Update_profile_can_clear_the_size() => WithTempUser(async (_, token) =>
    {
        var response = await Send(HttpMethod.Put, "/api/auth/me", token, new { firstName = "Ana", lastName = "Prueba", preferredSize = (string?)null, marketingOptIn = false });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await Json(response)).GetProperty("user").GetProperty("preferredSize").ValueKind);
    });

    [Theory]
    [InlineData("Ana", "Prueba", "XL", "PreferredSize")]
    [InlineData("Ana", "Prueba", "m", "PreferredSize")]
    [InlineData("", "Prueba", "M", "FirstName")]
    [InlineData("Ana", "", "M", "LastName")]
    public Task Update_profile_validates_like_the_registration(string firstName, string lastName, string size, string field) => WithTempUser(async (email, token) =>
    {
        var response = await Send(HttpMethod.Put, "/api/auth/me", token, new { firstName, lastName, preferredSize = size, marketingOptIn = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    });

    [Fact]
    public async Task Profile_and_password_require_a_bearer()
    {
        var profile = await Send(HttpMethod.Put, "/api/auth/me", null, new { firstName = "Ana", lastName = "Prueba", marketingOptIn = false });
        var password = await Send(HttpMethod.Post, "/api/auth/change-password", null, new { currentPassword = Password, newPassword = "Nueva2026" });
        var invalid = await Send(HttpMethod.Put, "/api/auth/me", "no-es-un-token", new { firstName = "Ana", lastName = "Prueba", marketingOptIn = false });

        Assert.Equal(HttpStatusCode.Unauthorized, profile.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, password.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, invalid.StatusCode);
    }

    [Fact]
    public Task Wrong_current_password_returns_400_on_that_field_and_keeps_the_password() => WithTempUser(async (email, token) =>
    {
        var response = await Send(HttpMethod.Post, "/api/auth/change-password", token, new { currentPassword = "Equivocada1", newPassword = "Nueva2026" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await Json(response)).GetProperty("errors");
        Assert.Equal(AuthController.WrongCurrentPassword, errors.GetProperty("CurrentPassword")[0].GetString());
        Assert.Equal(HttpStatusCode.OK, (await Login(email, Password)).StatusCode);
    });

    [Fact]
    public Task Weak_new_password_is_rejected() => WithTempUser(async (email, token) =>
    {
        var response = await Send(HttpMethod.Post, "/api/auth/change-password", token, new { currentPassword = Password, newPassword = "debil" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty("NewPassword", out _));
    });

    [Fact]
    public Task Change_password_returns_204_and_the_old_one_stops_working() => WithTempUser(async (email, token) =>
    {
        var response = await Send(HttpMethod.Post, "/api/auth/change-password", token, new { currentPassword = Password, newPassword = "Nueva2026" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login(email, Password)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(email, "Nueva2026")).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var hash = await db.Users.Where(u => u.Email == email).Select(u => u.PasswordHash).SingleAsync(Ct);
        Assert.DoesNotContain("Nueva2026", hash);
    });
}
