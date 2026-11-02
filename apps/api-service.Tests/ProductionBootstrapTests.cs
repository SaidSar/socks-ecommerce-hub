using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Guarda todo lo que se registra, para buscar contraseñas filtradas.</summary>
internal sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly List<string> _lines = [];

    public IReadOnlyList<string> Lines
    {
        get
        {
            lock (_lines)
            {
                return [.. _lines];
            }
        }
    }

    public ILogger CreateLogger(string categoryName) => new Logger(this);

    public void Dispose()
    {
    }

    private sealed class Logger(CapturingLoggerProvider owner) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            lock (owner._lines)
            {
                owner._lines.Add(formatter(state, exception) + exception);
            }
        }
    }
}

public sealed class BootstrapFactory : WebApplicationFactory<Program>
{
    internal CapturingLoggerProvider Logs { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Orders:OxxoExpiryJobEnabled", "false");
        builder.ConfigureLogging(logging => logging.AddProvider(Logs).SetMinimumLevel(LogLevel.Trace));
    }
}

/// <summary>Responde lo que la prueba le dio, en orden; guarda lo que se dijo en la terminal.</summary>
internal sealed class ScriptedPrompt(params string[] answers) : IBootstrapPrompt
{
    private readonly Queue<string> _answers = new(answers);

    public List<string> Said { get; } = [];

    public List<string> Asked { get; } = [];

    public string Ask(string question)
    {
        Asked.Add(question);
        return _answers.Dequeue();
    }

    public string AskSecret(string question)
    {
        Asked.Add(question);
        return _answers.Count > 0 ? _answers.Dequeue() : throw new InvalidOperationException($"No se esperaba otra contraseña: {question}");
    }

    public void Say(string message) => Said.Add(message);
}

public class ProductionBootstrapTests(BootstrapFactory factory) : IClassFixture<BootstrapFactory>, IAsyncLifetime
{
    private const string OwnerPassword = "Dueño-Sokko-2026-fuerte";
    private const string EasyPassword = "Pruebas2026";
    private const string CustomerEmail = "cliente@sokko.mx";

    private readonly string _ownerEmail = $"dueno-{Guid.NewGuid():N}@sokko.test";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.Users.Where(u => u.Email == _ownerEmail || u.Email == CustomerEmail).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private async Task<int> Run(IBootstrapPrompt prompt)
    {
        using var scope = factory.Services.CreateScope();
        var services = scope.ServiceProvider;
        return await new ProductionBootstrap(services.GetRequiredService<SokkoDbContext>(), services.GetRequiredService<IUserService>(), prompt).RunAsync(Ct);
    }

    private async Task<T> Query<T>(Func<SokkoDbContext, Task<T>> query)
    {
        using var scope = factory.Services.CreateScope();
        return await query(scope.ServiceProvider.GetRequiredService<SokkoDbContext>());
    }

    [Fact]
    public async Task Creates_the_accounts_with_their_roles_and_running_it_again_changes_nothing()
    {
        // La BD de pruebas ya trae a Daniel y Kevin de Development: se conservan tal cual.
        var danielBefore = await Query(db => db.Users.AsNoTracking().SingleAsync(u => u.Email == "daniel@sokko.mx", Ct));
        var ordersBefore = await Query(db => db.Orders.CountAsync(Ct));

        var first = new ScriptedPrompt(_ownerEmail, "Ana", "Dueña", OwnerPassword, OwnerPassword, EasyPassword, EasyPassword);
        Assert.Equal(0, await Run(first));

        var accounts = await Query(db => db.Users.AsNoTracking().Where(u => u.Email == _ownerEmail || u.Email == CustomerEmail).ToListAsync(Ct));
        var owner = accounts.Single(u => u.Email == _ownerEmail);
        var customer = accounts.Single(u => u.Email == CustomerEmail);
        Assert.Equal(UserRole.Owner, owner.Role);
        Assert.Equal(("Ana", "Dueña"), (owner.FirstName, owner.LastName));
        Assert.Equal(UserRole.Customer, customer.Role);
        Assert.Equal(("Cliente", "Demo"), (customer.FirstName, customer.LastName));
        Assert.NotNull(customer.AcceptedTermsAt);
        var hasher = new PasswordHasher<User>();
        Assert.NotEqual(PasswordVerificationResult.Failed, hasher.VerifyHashedPassword(owner, owner.PasswordHash, OwnerPassword));
        Assert.NotEqual(PasswordVerificationResult.Failed, hasher.VerifyHashedPassword(customer, customer.PasswordHash, EasyPassword));

        var daniel = await Query(db => db.Users.AsNoTracking().SingleAsync(u => u.Email == "daniel@sokko.mx", Ct));
        Assert.Equal(danielBefore.PasswordHash, daniel.PasswordHash);
        Assert.Equal(UserRole.Operations, daniel.Role);

        var catalog = await Query(async db => (await db.Products.CountAsync(Ct), await db.ProductVariants.CountAsync(Ct), await db.InventoryMovements.CountAsync(Ct)));

        // Otra vez: solo pregunta el correo del Dueño (ya existe) y no pide ninguna contraseña.
        var second = new ScriptedPrompt(_ownerEmail);
        Assert.Equal(0, await Run(second));
        Assert.DoesNotContain(second.Asked, q => q.StartsWith("Contraseña"));
        Assert.Equal(owner.PasswordHash, await Query(db => db.Users.Where(u => u.Email == _ownerEmail).Select(u => u.PasswordHash).SingleAsync(Ct)));
        Assert.Equal(catalog, await Query(async db => (await db.Products.CountAsync(Ct), await db.ProductVariants.CountAsync(Ct), await db.InventoryMovements.CountAsync(Ct))));
        Assert.Equal(ordersBefore, await Query(db => db.Orders.CountAsync(Ct)));
    }

    [Fact]
    public async Task Loads_the_seed_catalog()
    {
        await Run(new ScriptedPrompt(_ownerEmail, "Ana", "Dueña", OwnerPassword, OwnerPassword, EasyPassword, EasyPassword));

        var slugs = await Query(db => db.Products.Select(p => p.Slug).ToListAsync(Ct));
        Assert.All(DevelopmentSeed.Products, p => Assert.Contains(p.Slug, slugs));
        var skus = await Query(db => db.ProductVariants.Select(v => v.Sku).ToListAsync(Ct));
        Assert.All(DevelopmentSeed.Variants, v => Assert.Contains(v.Sku, skus));
    }

    [Fact]
    public async Task Weak_or_mismatched_passwords_are_asked_again_and_never_end_up_in_logs_or_output()
    {
        var prompt = new ScriptedPrompt(
            _ownerEmail, "Ana", "Dueña",
            "Corta1", // no cumple la política
            "Pruebas2026", // cumple, pero el Dueño necesita 12
            OwnerPassword, "otra-distinta", // no coinciden: tercer intento fallido
            "sobra");

        Assert.Equal(1, await Run(prompt));
        Assert.False(await Query(db => db.Users.AnyAsync(u => u.Email == _ownerEmail, Ct)));
        Assert.Contains(prompt.Said, s => s.Contains("12 caracteres"));

        var everything = string.Join('\n', prompt.Said.Concat(factory.Logs.Lines));
        foreach (var secret in new[] { "Corta1", "Pruebas2026", OwnerPassword, "otra-distinta" })
        {
            Assert.DoesNotContain(secret, everything);
        }
    }

    [Fact]
    public async Task Created_passwords_never_reach_logs()
    {
        await Run(new ScriptedPrompt(_ownerEmail, "Ana", "Dueña", OwnerPassword, OwnerPassword, EasyPassword, EasyPassword));

        var everything = string.Join('\n', factory.Logs.Lines);
        Assert.DoesNotContain(OwnerPassword, everything);
        Assert.DoesNotContain(EasyPassword, everything);
    }

    [Theory]
    [InlineData("Pruebas2026", false, true)]
    [InlineData("pruebas2026", false, false)]
    [InlineData("PRUEBAS2026", false, false)]
    [InlineData("Pruebasaaa", false, false)]
    [InlineData("Prueba1", false, false)]
    [InlineData("Pruebas2026", true, false)]
    [InlineData("Pruebas-2026!", true, true)]
    public void Password_policy_is_the_one_of_the_api(string password, bool strong, bool valid) =>
        Assert.Equal(valid, ProductionBootstrap.CheckPassword(password, strong) is null);
}
