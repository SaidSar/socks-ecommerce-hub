using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Services;

const string WebStoreCorsPolicy = "AllowWebStore";

var builder = WebApplication.CreateBuilder(args);

// Ajustes por máquina fuera de Git (por ejemplo, la contraseña de un SQL Server en Docker).
builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true, reloadOnChange: true);

// Add services to the container.

// Enums en JSON con los códigos de API de DESIGN_DB §1.6.
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)));

// SQL Server vía EF Core (DESIGN_DB.md). En producción la cadena llega por ConnectionStrings__Sokko (Azure SQL).
builder.Services.AddDbContext<SokkoDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Sokko")
        ?? throw new InvalidOperationException("Falta la cadena de conexión 'ConnectionStrings:Sokko'.");
    options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure());

    // Productos, SKU y usuarios demo solo en Development (DESIGN_DB §5); corre con `dotnet ef database update`.
    if (builder.Environment.IsDevelopment())
    {
        options
            .UseSeeding((context, _) => DevelopmentDataSeeder.Seed(context))
            .UseAsyncSeeding((context, _, cancellationToken) => DevelopmentDataSeeder.SeedAsync(context, cancellationToken));
    }
});

// Servicios de negocio (clasificación de Erl, DESIGN_DB §6).
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<ICollectionService, CollectionService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<IQuoteShipping, QuoteShipping>();

// CORS: permite que apps/web-store (Vite) consuma este servicio.
builder.Services.AddCors(options =>
{
    options.AddPolicy(WebStoreCorsPolicy, policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Documento OpenAPI en /openapi/v1.json y Swagger UI en /swagger
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "SOKKO API v1");
        options.DocumentTitle = "SOKKO API Service";
    });
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors(WebStoreCorsPolicy);

app.UseAuthorization();

app.MapControllers();

app.Run();

// Visible para WebApplicationFactory en las pruebas de integración.
public partial class Program;
