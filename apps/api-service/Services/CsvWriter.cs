using System.Globalization;
using System.Text;

namespace Sokko.Api.Services;

/// <summary>
/// CSV de los exportes del panel (Reportes y Clientes) para abrir en Excel en español: UTF-8 con BOM, separador <c>,</c>,
/// decimales con punto y fin de línea CRLF. Ninguna celda de texto puede convertirse en fórmula.
/// </summary>
public sealed class CsvWriter
{
    public const string ContentType = "text/csv; charset=utf-8";

    // Excel ejecuta como fórmula lo que empieza con estos caracteres (inyección CSV / DDE).
    private static readonly char[] FormulaStarts = ['=', '+', '-', '@', '\t', '\r'];

    private readonly StringBuilder _csv = new("﻿");

    public CsvWriter(params string[] header) => Row(header);

    /// <summary>Agrega una fila; cada valor pasa por <see cref="Cell"/>.</summary>
    public CsvWriter Row(params object?[] cells)
    {
        _csv.Append(string.Join(',', cells.Select(Cell))).Append("\r\n");
        return this;
    }

    public override string ToString() => _csv.ToString();

    public byte[] ToBytes() => Encoding.UTF8.GetBytes(_csv.ToString());

    /// <summary>
    /// Números con punto decimal (importes a 2 decimales). Texto: si empieza como fórmula se le antepone <c>'</c>; con coma,
    /// comillas o salto de línea va entre comillas dobles.
    /// </summary>
    public static string Cell(object? value)
    {
        var text = value switch
        {
            null => "",
            decimal d => d.ToString("0.00", CultureInfo.InvariantCulture),
            double d => d.ToString(CultureInfo.InvariantCulture),
            float f => f.ToString(CultureInfo.InvariantCulture),
            int or long or short or byte => Convert.ToString(value, CultureInfo.InvariantCulture)!,
            bool b => b ? "Sí" : "No",
            _ => Guard(Convert.ToString(value, CultureInfo.InvariantCulture) ?? ""),
        };
        return text.IndexOfAny(['"', ',', ';', '\n', '\r']) >= 0 ? $"\"{text.Replace("\"", "\"\"")}\"" : text;
    }

    /// <summary>Neutraliza una celda de texto que Excel tomaría como fórmula.</summary>
    public static string Guard(string text) => text.Length > 0 && FormulaStarts.Contains(text[0]) ? "'" + text : text;
}
