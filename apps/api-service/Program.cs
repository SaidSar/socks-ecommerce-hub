using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;

const string WebStoreCorsPolicy = "AllowWebStore";

var builder = WebApplication.CreateBuilder(args);

// Ajustes por máquina fuera de Git (por ejemplo, la contraseña de un SQL Server en Docker).
builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true, reloadOnChange: true);

// Add services to the container.

builder.Services.AddControllers();

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
