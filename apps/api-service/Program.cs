const string WebStoreCorsPolicy = "AllowWebStore";

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();

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
