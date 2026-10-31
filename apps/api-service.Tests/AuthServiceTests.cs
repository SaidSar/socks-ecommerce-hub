using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.JsonWebTokens;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class AuthServiceTests
{
    private static readonly JwtOptions Options = new("sokko-api", "sokko", new byte[32], TimeSpan.FromMinutes(120));
    private static readonly User Aiko = new() { Id = 1, Email = "hola@sokko.mx", Role = UserRole.Owner };

    private sealed class InstantClock(DateTime utcNow) : IClock
    {
        public DateTime UtcNow => utcNow;
        public DateOnly Today => DateOnly.FromDateTime(utcNow);
    }

    private static AuthService Service(DateTime? now = null, JwtOptions? options = null) =>
        new(options ?? Options, new InstantClock(now ?? DateTime.UtcNow));

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value)).Build();

    [Fact]
    public void Hash_verifies_only_the_right_password_and_never_stores_it_in_clear()
    {
        var service = Service();
        var user = new User { PasswordHash = service.HashPassword(Aiko, "Kyoto2026") };

        Assert.DoesNotContain("Kyoto2026", user.PasswordHash);
        Assert.Equal(PasswordCheck.Success, service.VerifyPassword(user, "Kyoto2026"));
        Assert.Equal(PasswordCheck.Failed, service.VerifyPassword(user, "kyoto2026"));
    }

    [Fact]
    public async Task Token_carries_id_email_and_role()
    {
        var service = Service();
        var token = service.IssueToken(Aiko);
        var principal = await service.ValidateTokenAsync(token.Token);

        Assert.Equal(7200, token.ExpiresIn);
        Assert.NotNull(principal);
        Assert.Equal("1", principal.FindFirstValue(JwtRegisteredClaimNames.Sub));
        Assert.Equal("hola@sokko.mx", principal.FindFirstValue(JwtRegisteredClaimNames.Email));
        Assert.True(principal.IsInRole("Owner"));
    }

    [Fact]
    public async Task Expired_token_is_rejected()
    {
        var valid = Service(DateTime.UtcNow.AddMinutes(-119)).IssueToken(Aiko);
        var expired = Service(DateTime.UtcNow.AddMinutes(-121)).IssueToken(Aiko);

        Assert.NotNull(await Service().ValidateTokenAsync(valid.Token));
        Assert.Null(await Service().ValidateTokenAsync(expired.Token));
    }

    [Fact]
    public async Task Token_signed_with_another_key_is_rejected()
    {
        var other = Service(options: Options with { SigningKey = Enumerable.Repeat((byte)7, 32).ToArray() });

        Assert.Null(await Service().ValidateTokenAsync(other.IssueToken(Aiko).Token));
        Assert.Null(await Service().ValidateTokenAsync("no-es-un-token"));
    }

    [Fact]
    public void Reset_token_is_stored_as_a_hash()
    {
        var service = Service();
        var token = service.CreateResetToken();

        Assert.Equal(32, token.Hash.Length);
        Assert.Equal(token.Hash, service.HashResetToken(token.Value));
        Assert.NotEqual(token.Value, Convert.ToBase64String(token.Hash));
    }

    [Fact]
    public void Missing_signing_key_stops_the_app_outside_development()
    {
        Assert.Throws<InvalidOperationException>(() => JwtOptions.FromConfiguration(Config(), isDevelopment: false));
        Assert.Throws<InvalidOperationException>(() => JwtOptions.FromConfiguration(Config(("Jwt:SigningKey", "corta")), isDevelopment: true));
        Assert.Equal(64, JwtOptions.FromConfiguration(Config(), isDevelopment: true).SigningKey.Length);
        Assert.Equal(40, JwtOptions.FromConfiguration(Config(("Jwt:SigningKey", new string('k', 40))), isDevelopment: false).SigningKey.Length);
    }

    [Fact]
    public void Operations_has_the_same_permissions_as_the_panel()
    {
        Assert.Equal(16, Permissions.All.Length);
        Assert.Equal(
            ["orders.manage", "inventory.adjust", "catalog.view", "shipping.view"],
            Permissions.All.Where(Permissions.OperationsCan).OrderBy(p => Array.IndexOf<string>(["orders.manage", "inventory.adjust", "catalog.view", "shipping.view"], p)));
        Assert.False(Permissions.IsStaff(UserRole.Customer));
    }
}

public class AuthTaskTests
{
    private sealed class FakeUsers(User? existing = null) : IUserService
    {
        public (int UserId, byte[] Hash, DateTime ExpiresAt)? Saved { get; private set; }
        public byte[]? ConsumedHash { get; private set; }
        public bool ResetResult { get; init; } = true;

        public Task<User?> GetActiveByIdAsync(int id, CancellationToken cancellationToken = default) => Task.FromResult(existing);
        public Task<User?> FindActiveByEmailAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult(existing);
        public Task<User?> ValidateCredentialsAsync(string email, string password, CancellationToken cancellationToken = default) => Task.FromResult(existing);
        public Task<User?> CreateCustomerAsync(NewCustomer customer, CancellationToken cancellationToken = default) => Task.FromResult(existing);
        public Task<IReadOnlyList<User>> ListInternalAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<User>>([]);
        public Task<User?> CreateInternalAsync(string firstName, string lastName, string email, UserRole role, CancellationToken cancellationToken = default) => Task.FromResult(existing);

        public Task AddResetTokenAsync(int userId, byte[] tokenHash, DateTime expiresAt, CancellationToken cancellationToken = default)
        {
            Saved = (userId, tokenHash, expiresAt);
            return Task.CompletedTask;
        }

        public Task<bool> ResetPasswordAsync(byte[] tokenHash, string newPassword, CancellationToken cancellationToken = default)
        {
            ConsumedHash = tokenHash;
            return Task.FromResult(ResetResult);
        }
    }

    private sealed class FakeEmail : IEmailSender
    {
        public List<(string Email, string Link)> Sent { get; } = [];

        public Task SendPasswordResetAsync(string email, string link, CancellationToken cancellationToken = default)
        {
            Sent.Add((email, link));
            return Task.CompletedTask;
        }

        public Task SendInvitationAsync(string email, string link, CancellationToken cancellationToken = default) =>
            SendPasswordResetAsync(email, link, cancellationToken);

        public Task SendOrderConfirmationAsync(OrderConfirmationEmail order, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private static readonly FakeClock Clock = new(new DateOnly(2026, 10, 30));
    private static readonly AuthService Auth = new(new JwtOptions("i", "a", new byte[32], TimeSpan.FromHours(2)), Clock);
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static ResetPassword Reset(FakeUsers users, FakeEmail email) =>
        new(users, Auth, email, Clock, new ResetLinkOptions("http://tienda.test/"));

    [Fact]
    public async Task Request_saves_only_the_hash_with_30_minutes_and_sends_the_clear_token()
    {
        var users = new FakeUsers(new User { Id = 9, Email = "nexus@sokko.mx" });
        var email = new FakeEmail();

        await Reset(users, email).RequestAsync("nexus@sokko.mx", Ct);

        var (address, link) = Assert.Single(email.Sent);
        Assert.Equal("nexus@sokko.mx", address);
        Assert.StartsWith("http://tienda.test/cuenta/restablecer?token=", link);
        var token = Uri.UnescapeDataString(link[(link.IndexOf('=') + 1)..]);
        Assert.Equal(9, users.Saved!.Value.UserId);
        Assert.Equal(Auth.HashResetToken(token), users.Saved.Value.Hash);
        Assert.Equal(Clock.UtcNow.AddMinutes(30), users.Saved.Value.ExpiresAt);
    }

    [Theory]
    [InlineData("nadie@sokko.mx")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Request_for_an_unknown_email_sends_nothing(string? address)
    {
        var users = new FakeUsers();
        var email = new FakeEmail();

        await Reset(users, email).RequestAsync(address, Ct);

        Assert.Empty(email.Sent);
        Assert.Null(users.Saved);
    }

    [Fact]
    public async Task Reset_consumes_the_hash_of_the_token()
    {
        var users = new FakeUsers();

        Assert.True(await Reset(users, new FakeEmail()).ResetAsync("abc", "Nueva2026", Ct));
        Assert.Equal(Auth.HashResetToken("abc"), users.ConsumedHash);
    }

    [Fact]
    public async Task Reset_reports_an_invalid_token()
    {
        Assert.False(await Reset(new FakeUsers { ResetResult = false }, new FakeEmail()).ResetAsync("abc", "Nueva2026", Ct));
    }

    [Fact]
    public async Task Register_returns_null_when_the_email_is_taken()
    {
        var customer = new NewCustomer("A", "B", "a@b.mx", "Clave2026", null, false);

        Assert.Null(await new RegisterCustomer(new FakeUsers()).RegisterAsync(customer, Ct));
        var created = new User { Id = 3 };
        Assert.Same(created, await new RegisterCustomer(new FakeUsers(created)).RegisterAsync(customer, Ct));
    }
}
