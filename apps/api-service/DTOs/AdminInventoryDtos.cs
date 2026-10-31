using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>Renglón de inventario. Es el mismo para los dos roles y no tiene cifras en pesos (R-24).</summary>
public record InventoryRowDto(
    string Sku,
    string PieceId,
    string Piece,
    string Tone,
    string ToneName,
    string ToneHex,
    string Size,
    int Stock,
    int Reserved,
    int Available,
    string State,
    int? Edition,
    ProductLine Line,
    string Unit,
    byte[] RowVersion);

public record InventoryStatsDto(int Units, int Reserved, int Out, int Few);

public record InventoryListDto(IReadOnlyList<InventoryRowDto> Rows, IReadOnlyDictionary<string, int> Counts, InventoryStatsDto Stats, int Few, int Count);

public record InventoryMovementDto(string Sku, InventoryMovementType Type, int Qty, int Balance, DateTime Date, string User, string? Note, string? Order);

public record InventoryAdjustmentDto(InventoryRowDto Row, InventoryMovementDto Movement);

/// <summary>Movimiento manual (DESIGN_ADMIN §5.3): <c>Qty</c> es la cantidad, o lo contado en un conteo físico.</summary>
public class InventoryMovementRequestDto
{
    public InventoryMovementType? Type { get; init; }

    public int? Qty { get; init; }

    [StringLength(250, ErrorMessage = "El motivo admite hasta 250 caracteres.")]
    public string? Note { get; init; }

    public string? Folio { get; init; }

    public byte[]? RowVersion { get; init; }
}

public class InventoryImportRequestDto
{
    public string? Csv { get; init; }
}

/// <summary>Fila de la vista previa, con la forma de <c>domain/importCsv.js</c>. <c>Stock</c> es el texto del archivo si no es un entero.</summary>
public record ImportRowDto(
    int Line,
    string Sku,
    string Piece,
    string Tone,
    string Size,
    object Stock,
    IReadOnlyDictionary<string, string> Extra,
    IReadOnlyDictionary<string, object> Changes,
    string Warning,
    string Error);

public record ImportPreviewDto(string Error, IReadOnlyList<string> Columns, IReadOnlyList<ImportRowDto> Rows, IReadOnlyList<ImportRowDto> Valid, IReadOnlyList<ImportRowDto> Invalid);

public record ImportResultDto(int Applied, int Skipped);
