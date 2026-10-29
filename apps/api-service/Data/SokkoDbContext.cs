using Microsoft.EntityFrameworkCore;
using Sokko.Api.Models;

namespace Sokko.Api.Data;

/// <summary>
/// Unidad de trabajo de SQL Server. El esquema completo (tablas, CHECK, índices y semillas de catálogo) sale de
/// <c>docs/design/DESIGN_DB.md</c> v0.4.2; cada tabla se configura en <c>Data/Configurations</c>.
/// </summary>
public class SokkoDbContext(DbContextOptions<SokkoDbContext> options) : DbContext(options)
{
    /// <summary>Intercalación de la BD (DESIGN_DB §1.2, D-23): búsquedas sin distinguir mayúsculas ni acentos.</summary>
    public const string Collation = "Modern_Spanish_100_CI_AI";

    /// <summary>Secuencia del folio <c>SKK-####</c> (DESIGN_DB §1.5, D-08).</summary>
    public const string OrderFolioSequence = "OrderFolioSeq";

    public DbSet<User> Users => Set<User>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Color> Colors => Set<Color>();
    public DbSet<Size> Sizes => Set<Size>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<ProductType> ProductTypes => Set<ProductType>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<LocalDeliveryZone> LocalDeliveryZones => Set<LocalDeliveryZone>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // DESIGN_DB §1.2: dinero DECIMAL(10,2) salvo tasas y porcentajes (5,4), que se fijan por columna.
        configurationBuilder.Properties<decimal>().HavePrecision(10, 2);
        configurationBuilder.Properties<decimal?>().HavePrecision(10, 2);
        // DATETIME2(3) en UTC.
        configurationBuilder.Properties<DateTime>().HaveColumnType("datetime2(3)").HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveColumnType("datetime2(3)").HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("dbo");
        modelBuilder.UseCollation(Collation);
        // Defaults con nombre DF_{Tabla}_{Columna} (DESIGN_DB §1.1).
        modelBuilder.UseNamedDefaultConstraints();

        // EF no modela NO CACHE: la migración inicial lo agrega con ALTER SEQUENCE para no perder folios tras un reinicio.
        modelBuilder.HasSequence<int>(OrderFolioSequence)
            .StartsAt(1001)
            .IncrementsBy(1);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SokkoDbContext).Assembly);
    }
}
