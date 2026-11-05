using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;

namespace Sokko.Api.Tests;

/// <summary>
/// Raíz del repositorio, sin depender de dónde quedó la salida de la compilación (<c>bin/Debug</c>, <c>--artifacts-path</c>, CI):
/// se sube desde la carpeta del proyecto (guardada en el ensamblado al compilar), la de ejecución y la actual, hasta
/// encontrar <c>.git</c> o el <c>.slnx</c>.
/// </summary>
internal static class RepoRoot
{
    private static readonly Lazy<DirectoryInfo> Root = new(Find);

    public static string Path(params string[] parts) => System.IO.Path.Combine([Root.Value.FullName, .. parts]);

    private static DirectoryInfo Find()
    {
        var projectDirectory = typeof(RepoRoot).Assembly.GetCustomAttributes(typeof(System.Reflection.AssemblyMetadataAttribute), false)
            .Cast<System.Reflection.AssemblyMetadataAttribute>()
            .FirstOrDefault(a => a.Key == "ProjectDirectory")?.Value;
        foreach (var start in new[] { projectDirectory, AppContext.BaseDirectory, Directory.GetCurrentDirectory() }.OfType<string>())
        {
            for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
            {
                var isRoot = Directory.Exists(System.IO.Path.Combine(dir.FullName, ".git"))
                    || File.Exists(System.IO.Path.Combine(dir.FullName, ".git"))
                    || File.Exists(System.IO.Path.Combine(dir.FullName, "apps", "api-service", "api-service-Sokko.Api.slnx"));
                if (isRoot && Directory.Exists(System.IO.Path.Combine(dir.FullName, "apps")))
                {
                    return dir;
                }
            }
        }
        throw new DirectoryNotFoundException("No se encontró la raíz del repositorio (carpeta con .git y apps/).");
    }
}

/// <summary>
/// Base de datos exclusiva de las pruebas de integración (<c>Sokko_Tests</c>), en el mismo servidor que la de desarrollo.
/// Así la API de desarrollo, el panel o un depurador abiertos sobre <c>Sokko</c> no pueden dejar bloqueos que hagan
/// fallar una prueba por tiempo de espera. Se migra y se siembra (semilla de Development) una vez por corrida.
/// </summary>
internal static class TestDatabase
{
    public const string Name = "Sokko_Tests";

    private static readonly Lazy<string> Prepared = new(Prepare, LazyThreadSafetyMode.ExecutionAndPublication);

    /// <summary>Cadena de conexión a <see cref="Name"/>, con la BD ya migrada y sembrada.</summary>
    public static string ConnectionString => Prepared.Value;

    /// <summary>
    /// La cadena de Development (o <c>ConnectionStrings__Sokko</c> si está definida, como en CI) con otra base de datos.
    /// </summary>
    private static string BaseConnectionString()
    {
        var api = RepoRoot.Path("apps", "api-service");
        var config = new ConfigurationBuilder()
            .AddJsonFile(System.IO.Path.Combine(api, "appsettings.json"), optional: true)
            .AddJsonFile(System.IO.Path.Combine(api, "appsettings.Development.json"), optional: true)
            .AddJsonFile(System.IO.Path.Combine(api, "appsettings.Development.local.json"), optional: true)
            .AddEnvironmentVariables()
            .Build();
        return config.GetConnectionString("Sokko")
            ?? "Server=localhost;Database=Sokko;Trusted_Connection=True;TrustServerCertificate=True";
    }

    private static string Prepare()
    {
        var connectionString = new SqlConnectionStringBuilder(BaseConnectionString()) { InitialCatalog = Name }.ConnectionString;
        var options = new DbContextOptionsBuilder<SokkoDbContext>()
            .UseSqlServer(connectionString, sql => sql.CommandTimeout(300))
            .UseSeeding((context, _) => DevelopmentDataSeeder.Seed(context))
            .UseAsyncSeeding((context, _, cancellationToken) => DevelopmentDataSeeder.SeedAsync(context, cancellationToken))
            .Options;
        using var db = new SokkoDbContext(options);
        // Crea la BD si no existe, aplica las migraciones pendientes y corre la semilla (idempotente).
        db.Database.Migrate();
        return connectionString;
    }

    /// <summary>Apunta la API de la prueba a <see cref="Name"/>. Va después de la configuración de Program, así que gana.</summary>
    public static IWebHostBuilder UseTestDatabase(this IWebHostBuilder builder) =>
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Sokko"] = ConnectionString,
        }));
}
