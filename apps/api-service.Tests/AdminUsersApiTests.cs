using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;

namespace Sokko.Api.Tests;

public class AdminUsersApiTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    private const string Url = "/api/admin/users";
    private const string InviteUrl = "/api/admin/users/invitations";

    private readonly string _email = $"invitado-{Guid.NewGuid():N}@sokko.test";

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.Users.Where(u => u.Email == _email).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private object Invitation(string? email = null, string role = "operaciones") => new { firstName = "Ivana", lastName = "Prueba", email = email ?? _email, role };

    [Fact]
    public async Task Only_the_owner_lists_and_invites()
    {
        foreach (var (role, status) in new (string?, HttpStatusCode)[] { (null, HttpStatusCode.Unauthorized), (Customer, HttpStatusCode.Forbidden), (Operations, HttpStatusCode.Forbidden) })
        {
            Assert.Equal(status, (await Get(Url, role)).StatusCode);
            Assert.Equal(status, (await Post(InviteUrl, role, Invitation())).StatusCode);
        }
    }

    [Fact]
    public async Task List_has_only_staff_with_panel_role_codes()
    {
        var users = (await Json(await Get(Url, Owner))).EnumerateArray().ToList();

        var aiko = users.Single(u => u.GetProperty("email").GetString() == "hola@sokko.mx");
        Assert.Equal("Aiko Morales", aiko.GetProperty("name").GetString());
        Assert.Equal("dueno", aiko.GetProperty("role").GetString());
        Assert.DoesNotContain(users, u => u.GetProperty("email").GetString() == "nexus@sokko.mx");
        Assert.All(users, u => Assert.False(u.TryGetProperty("passwordHash", out _)));
    }

    [Fact]
    public async Task Invitation_sends_a_link_and_the_account_starts_with_it()
    {
        var created = await Post(InviteUrl, Owner, Invitation());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("operaciones", (await Json(created)).GetProperty("role").GetString());
        Assert.Contains(_email, (await Json(await Get(Url, Owner))).EnumerateArray().Select(u => u.GetProperty("email").GetString()));

        var link = Factory.Email.LinkFor(_email);
        Assert.Contains("/cuenta/restablecer?token=", link);
        var token = Uri.UnescapeDataString(link[(link.IndexOf("token=", StringComparison.Ordinal) + 6)..]);

        // Antes de usar el enlace nadie puede entrar.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client.PostAsJsonAsync("/api/admin/auth/login", new { email = _email, password = "Nueva2026" }, Ct)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Client.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "Nueva2026" }, Ct)).StatusCode);
        var login = await Client.PostAsJsonAsync("/api/admin/auth/login", new { email = _email, password = "Nueva2026" }, Ct);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal("operaciones", (await Json(login)).GetProperty("user").GetProperty("role").GetString());
    }

    [Fact]
    public async Task Email_with_an_account_gets_409()
    {
        var response = await Post(InviteUrl, Owner, Invitation("  NEXUS@sokko.mx "));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("ya tiene una cuenta", (await Json(response)).GetProperty("errors").GetProperty("email").GetString());
    }

    [Theory]
    [InlineData("sin-arroba", "operaciones", "Email")]
    [InlineData("x@sokko.test", "customer", "Role")]
    [InlineData("x@sokko.test", "Owner", "Role")]
    public async Task Invalid_invitation_gets_400(string email, string role, string field)
    {
        var response = await Post(InviteUrl, Owner, Invitation(email, role));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }
}
