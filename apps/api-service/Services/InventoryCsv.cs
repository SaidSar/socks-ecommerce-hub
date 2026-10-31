using System.Globalization;
using System.Text;

namespace Sokko.Api.Services;

/// <summary>Lectura del CSV de inventario: lo mismo que <c>detectSeparator</c>, <c>parseCsv</c> y <c>normalize</c> del panel.</summary>
public static class InventoryCsv
{
    public static readonly string[] Columns = ["SKU", "Pieza", "Tono", "Talla", "Stock"];
    public static readonly string[] ExtraColumns = ["line", "brand", "type", "collection", "units_per_pack", "unit_cost", "barcode"];

    /// <summary>Sin distinguir mayúsculas ni acentos.</summary>
    public static string Normalize(string? text)
    {
        var plain = new string((text ?? "").Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray());
        return plain.ToLowerInvariant().Trim();
    }

    /// <summary>El separador que más aparece en el encabezado, fuera de comillas.</summary>
    public static char DetectSeparator(string headerLine)
    {
        var (commas, semis, quoted) = (0, 0, false);
        foreach (var c in headerLine)
        {
            if (c == '"')
            {
                quoted = !quoted;
            }
            else if (!quoted && c == ',')
            {
                commas++;
            }
            else if (!quoted && c == ';')
            {
                semis++;
            }
        }
        return semis > commas ? ';' : ',';
    }

    /// <summary>Filas y celdas, respetando comillas dobles ("a, b" y "" escapadas).</summary>
    public static List<List<string>> Parse(string text, char separator)
    {
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"')
                {
                    cell.Append('"');
                    i++;
                }
                else if (c == '"')
                {
                    quoted = false;
                }
                else
                {
                    cell.Append(c);
                }
            }
            else if (c == '"')
            {
                quoted = true;
            }
            else if (c == separator)
            {
                row.Add(cell.ToString());
                cell.Clear();
            }
            else if (c is '\n' or '\r')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n')
                {
                    i++;
                }
                row.Add(cell.ToString());
                rows.Add(row);
                row = [];
                cell.Clear();
            }
            else
            {
                cell.Append(c);
            }
        }
        if (cell.Length > 0 || row.Count > 0)
        {
            row.Add(cell.ToString());
            rows.Add(row);
        }
        return rows;
    }

    public static string Cell(object? value)
    {
        var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
        return text.IndexOfAny(['"', ',', ';', '\n', '\r']) >= 0 ? $"\"{text.Replace("\"", "\"\"")}\"" : text;
    }
}
