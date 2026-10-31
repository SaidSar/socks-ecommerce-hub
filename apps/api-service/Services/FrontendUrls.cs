namespace Sokko.Api.Services;

/// <summary>Orígenes de la tienda y del panel: <c>Frontend:WebStoreUrl</c> y <c>Frontend:AdminPanelUrl</c>, con una o varias URLs separadas por coma.</summary>
public static class FrontendUrls
{
    private const string WebStoreKey = "Frontend:WebStoreUrl";
    private const string AdminPanelKey = "Frontend:AdminPanelUrl";

    /// <summary>La URL principal de la tienda, para los enlaces de los correos.</summary>
    public static string WebStore(IConfiguration configuration)
    {
        var urls = Parse(configuration[WebStoreKey]);
        return urls.Count > 0 ? urls[0] : throw new InvalidOperationException($"Falta {WebStoreKey}.");
    }

    /// <summary>Todos los orígenes permitidos por CORS. Nunca un comodín.</summary>
    public static string[] CorsOrigins(IConfiguration configuration)
    {
        var origins = Parse(configuration[WebStoreKey]).Concat(Parse(configuration[AdminPanelKey])).Distinct().ToArray();
        return origins.Length > 0 ? origins : throw new InvalidOperationException($"Faltan {WebStoreKey} y {AdminPanelKey}.");
    }

    public static IReadOnlyList<string> Parse(string? value) =>
        (value ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(ToOrigin)
            .ToList();

    private static string ToOrigin(string url)
    {
        if (url.Contains('*') || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
        {
            throw new InvalidOperationException($"La URL de Frontend no es válida: '{url}'.");
        }
        return uri.GetLeftPart(UriPartial.Authority);
    }
}
