using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Services;

const string FrontendCorsPolicy = "AllowFrontends";

var builder = WebApplication.CreateBuilder(args);

// Ajustes por máquina fuera de Git (por ejemplo, la contraseña de un SQL Server en Docker).
builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true, reloadOnChange: true);

// Add services to the container.

// Enums en JSON con los códigos de API de DESIGN_DB §1.6.
builder.Services.AddControllers(options => options.Filters.Add<ConcurrencyExceptionFilter>())
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower, allowIntegerValues: false)));

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
builder.Services.AddSingleton(_ => JwtOptions.FromConfiguration(builder.Configuration, builder.Environment.IsDevelopment()));
builder.Services.AddSingleton(_ => new ResetLinkOptions(FrontendUrls.WebStore(builder.Configuration)));
builder.Services.AddSingleton<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IRegisterCustomer, RegisterCustomer>();
builder.Services.AddScoped<IResetPassword, ResetPassword>();
builder.Services.AddScoped<IInviteUser, InviteUser>();
builder.Services.AddSingleton(provider => EmailSetup.Create(provider, builder.Configuration, builder.Environment.IsDevelopment()));

builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IOrderAdminService, OrderAdminService>();
builder.Services.AddScoped<IFulfillOrder, FulfillOrder>();
builder.Services.AddScoped<IInventoryAdminService, InventoryAdminService>();
builder.Services.AddScoped<IAdjustInventory, AdjustInventory>();
builder.Services.AddScoped<IImportInventory, ImportInventory>();
builder.Services.AddScoped<IExportService, ExportService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IOrderConfirmation, OrderConfirmation>();
builder.Services.AddScoped<ICheckoutOrder, CheckoutOrder>();
builder.Services.AddScoped<IExpireOxxoOrders, ExpireOxxoOrders>();
builder.Services.AddSingleton<IPaymentGateway, FakePaymentGateway>();
builder.Services.AddHostedService<OxxoExpiryJob>();

builder.Services.AddScoped<ICatalogAdminService, CatalogAdminService>();
builder.Services.AddScoped<IBrandService, BrandService>();
builder.Services.AddScoped<IProductTypeService, ProductTypeService>();

builder.Services.AddSokkoAuth();
builder.Services.AddAuthRateLimiting();
// Errores y respuestas sin cuerpo (401, 403, 404…) como ProblemDetails.
builder.Services.AddProblemDetails();

builder.Services.AddHealthChecks().AddDbContextCheck<SokkoDbContext>();

// Detrás del proxy de App Service: su IP cambia, así que no hay lista de proxies conocidos. Con ForwardLimit = 1 solo cuenta el
// último valor, el que agrega App Service; lo que el cliente escriba en el encabezado queda a la izquierda y se ignora.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// CORS: solo los orígenes de Frontend:WebStoreUrl y Frontend:AdminPanelUrl.
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(FrontendUrls.CorsOrigins(builder.Configuration))
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Sin clave de firma o sin URL de la tienda, falla al arrancar y no en la primera petición.
_ = app.Services.GetRequiredService<JwtOptions>();
_ = app.Services.GetRequiredService<ResetLinkOptions>();
_ = app.Services.GetRequiredService<IEmailSender>();

// Configure the HTTP request pipeline.
// Antes que todo: el rate limiting, la autenticación y la redirección a HTTPS usan la IP y el esquema reales.
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();

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

app.UseCors(FrontendCorsPolicy);

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Visible para WebApplicationFactory en las pruebas de integración.
public partial class Program;
