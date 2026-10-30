using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Sokko.Api.Data;
using Sokko.Api.Models;

namespace Sokko.Api.Tests;

/// <summary>Reglas del esquema de DESIGN_DB que se pueden comprobar sin base de datos.</summary>
public class ModelTests
{
    [Fact]
    public void Migrations_are_in_sync_with_the_model()
    {
        using var db = TestDbContext.Create();

        Assert.False(db.Database.HasPendingModelChanges(),
            "El modelo cambió sin migración: corra `dotnet ef migrations add <Nombre>` en apps/api-service.");
    }

    [Fact]
    public void Only_password_reset_tokens_cascade_on_delete()
    {
        // D-07: todas las FK son NO ACTION salvo PasswordResetTokens.UserId.
        using var db = TestDbContext.Create();
        var foreignKeys = db.DesignModel().GetEntityTypes().SelectMany(e => e.GetForeignKeys()).ToList();

        var cascading = foreignKeys.Where(fk => fk.DeleteBehavior != DeleteBehavior.NoAction).ToList();

        var fk = Assert.Single(cascading);
        Assert.Equal(typeof(PasswordResetToken), fk.DeclaringEntityType.ClrType);
        Assert.Equal(DeleteBehavior.Cascade, fk.DeleteBehavior);
    }

    [Fact]
    public void Database_uses_spanish_case_and_accent_insensitive_collation()
    {
        using var db = TestDbContext.Create();

        Assert.Equal(SokkoDbContext.Collation, db.DesignModel().GetCollation());
    }

    [Fact]
    public void Money_columns_are_decimal_10_2_and_rates_are_decimal_5_4()
    {
        using var db = TestDbContext.Create();
        var decimals = db.DesignModel().GetEntityTypes()
            .SelectMany(e => e.GetProperties())
            .Where(p => Nullable.GetUnderlyingType(p.ClrType) == typeof(decimal) || p.ClrType == typeof(decimal))
            .Where(p => p.GetComputedColumnSql() is null)
            .ToList();
        string[] rates = [nameof(Order.TaxRate), nameof(Setting.IvaRate), nameof(Collection.OffSeasonDiscountPct)];

        Assert.All(decimals, p =>
        {
            var expected = rates.Contains(p.Name) ? (5, 4) : (10, 2);
            Assert.Equal(expected, (p.GetPrecision(), p.GetScale()));
        });
    }

    [Fact]
    public void Dates_are_datetime2_3()
    {
        using var db = TestDbContext.Create();
        var dates = db.DesignModel().GetEntityTypes()
            .SelectMany(e => e.GetProperties())
            .Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?));

        Assert.All(dates, p => Assert.Equal("datetime2(3)", p.GetColumnType()));
    }

    [Fact]
    public void Enums_are_stored_as_varchar_with_a_check_constraint()
    {
        using var db = TestDbContext.Create();
        var enums = db.DesignModel().GetEntityTypes()
            .SelectMany(e => e.GetProperties().Select(p => (Entity: e, Property: p)))
            .Where(x => (Nullable.GetUnderlyingType(x.Property.ClrType) ?? x.Property.ClrType).IsEnum)
            .ToList();

        Assert.NotEmpty(enums);
        Assert.All(enums, x =>
        {
            Assert.Equal(typeof(string), x.Property.GetProviderClrType());
            Assert.False(x.Property.IsUnicode());
            var column = x.Property.GetColumnName();
            Assert.Contains(x.Entity.GetCheckConstraints(), c => c.Sql.Contains($"[{column}] IN ("));
        });
    }
}
