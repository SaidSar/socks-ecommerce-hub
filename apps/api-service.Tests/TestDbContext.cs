using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Sokko.Api.Data;

namespace Sokko.Api.Tests;

/// <summary>Contexto sin conexión real: basta para inspeccionar el modelo y compararlo con la migración.</summary>
internal static class TestDbContext
{
    public static SokkoDbContext Create() =>
        new(new DbContextOptionsBuilder<SokkoDbContext>()
            .UseSqlServer("Server=localhost;Database=SokkoTests;Trusted_Connection=True;TrustServerCertificate=True")
            .Options);

    /// <summary>Modelo de diseño: conserva las anotaciones (intercalación, convertidores) que el modelo de ejecución recorta.</summary>
    public static IModel DesignModel(this SokkoDbContext db) => db.GetService<IDesignTimeModel>().Model;
}
