using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

public class BrandCreateDto
{
    [Required(ErrorMessage = "Escribe el nombre de la marca.")]
    [StringLength(60)]
    public string? Name { get; init; }
}

public class BrandUpdateDto
{
    [StringLength(60)]
    public string? Name { get; init; }

    public bool? ShowInFilters { get; init; }

    public bool? IsActive { get; init; }

    [Required(ErrorMessage = "Falta la versión del registro.")]
    public byte[]? RowVersion { get; init; }
}

public class ProductTypeCreateDto
{
    [Required(ErrorMessage = "Escribe el código del tipo.")]
    [RegularExpression("^[a-z0-9-]{1,20}$", ErrorMessage = "El código solo admite minúsculas, números y guiones.")]
    public string? Code { get; init; }

    [Required(ErrorMessage = "Escribe el nombre del tipo.")]
    [StringLength(40)]
    public string? Name { get; init; }

    [Required(ErrorMessage = "Elige un sistema de tallas.")]
    public SizeSystem? SizeSystem { get; init; }

    [Required(ErrorMessage = "Elige cómo se cuenta.")]
    public UnitLabel? Unit { get; init; }
}

public class ProductTypeUpdateDto
{
    [StringLength(40)]
    public string? Name { get; init; }

    public SizeSystem? SizeSystem { get; init; }

    public UnitLabel? Unit { get; init; }

    public bool? IsActive { get; init; }

    [Required(ErrorMessage = "Falta la versión del registro.")]
    public byte[]? RowVersion { get; init; }
}

/// <summary>Colección del editor (DESIGN_CATALOG_UI §4.5). Al crear, <c>Name</c> y <c>Kind</c> son obligatorios.</summary>
public class CollectionRequestDto
{
    [StringLength(80)]
    public string? Name { get; init; }

    public CollectionKind? Kind { get; init; }

    public int? StartMonth { get; init; }

    public int? StartDay { get; init; }

    public int? EndMonth { get; init; }

    public int? EndDay { get; init; }

    public decimal? OffSeasonDiscountPct { get; init; }

    public bool? IsActive { get; init; }

    /// <summary>Obligatorio al editar (R-25).</summary>
    public byte[]? RowVersion { get; init; }
}
