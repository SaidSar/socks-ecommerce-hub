using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Sokko.Api.Data;

/// <summary>Atajos para mapear las convenciones de DESIGN_DB §1 sin repetirlas en cada configuración.</summary>
internal static class ModelBuilderExtensions
{
    /// <summary>Intercalación binaria para los CHECK de patrones ASCII (la de la BD es CI_AI).</summary>
    public const string BinaryCollation = "Latin1_General_100_BIN2";

    /// <summary>Enum guardado como su nombre en <c>VARCHAR(n)</c> (DESIGN_DB §1.3, D-04).</summary>
    public static PropertyBuilder<TEnum> HasEnumColumn<TEnum>(this PropertyBuilder<TEnum> property, int maxLength)
        where TEnum : struct, Enum =>
        property.HasConversion<string>().HasMaxLength(maxLength).IsUnicode(false);

    /// <inheritdoc cref="HasEnumColumn{TEnum}(PropertyBuilder{TEnum}, int)"/>
    public static PropertyBuilder<TEnum?> HasEnumColumn<TEnum>(this PropertyBuilder<TEnum?> property, int maxLength)
        where TEnum : struct, Enum =>
        property.HasConversion<string>().HasMaxLength(maxLength).IsUnicode(false);

    /// <summary>Código técnico ASCII: <c>VARCHAR(n)</c>, o <c>CHAR(n)</c> si <paramref name="fixedLength"/>.</summary>
    public static PropertyBuilder<string> HasAsciiColumn(this PropertyBuilder<string> property, int maxLength, bool fixedLength = false) =>
        property.HasMaxLength(maxLength).IsUnicode(false).IsFixedLength(fixedLength);

    /// <summary>
    /// Default de BD (<c>DF_</c>) para quien inserte por SQL. EF siempre manda el valor (<c>ValueGeneratedNever</c>):
    /// así un <c>false</c> explícito sobre un default <c>1</c> no se pierde, ni al guardar ni en el <c>HasData</c> de la
    /// migración. El inicializador de la propiedad en C# debe valer lo mismo que <paramref name="value"/>.
    /// </summary>
    public static PropertyBuilder<T> HasDbDefault<T>(this PropertyBuilder<T> property, T value) =>
        property.HasDefaultValue(value).ValueGeneratedNever();

    /// <summary>Columna <c>DATETIME2(3)</c> con default <c>SYSUTCDATETIME()</c> (DESIGN_DB §1.2, D-03).</summary>
    public static PropertyBuilder<DateTime> HasUtcNowDefault(this PropertyBuilder<DateTime> property) =>
        property.HasDefaultValueSql("SYSUTCDATETIME()");

    /// <summary><c>[Columna] IN ('A','B')</c> a partir de los nombres del enum, para que el CHECK no se desfase del código.</summary>
    public static string SqlIn<TEnum>(string column, params TEnum[] values) where TEnum : struct, Enum
    {
        var list = values.Length == 0 ? Enum.GetValues<TEnum>() : values;
        return $"[{column}] IN ({string.Join(", ", list.Select(v => $"'{v}'"))})";
    }

    /// <summary>Slug o código de API: solo minúsculas ASCII, dígitos y guion.</summary>
    public static string SqlSlug(string column) =>
        $"[{column}] COLLATE {BinaryCollation} NOT LIKE '%[^a-z0-9-]%'";

    /// <summary>CP mexicano de 5 dígitos.</summary>
    public static string SqlPostalCode(string column) =>
        $"[{column}] LIKE '[0-9][0-9][0-9][0-9][0-9]'";
}
