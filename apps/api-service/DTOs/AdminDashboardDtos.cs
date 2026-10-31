using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

public record DashboardMoneyDto(decimal Value, decimal Prev, double? Delta);

public record DashboardCountDto(int Value, int Prev, double? Delta);

public record DashboardPercentDto(double Value, double Prev, double? Delta);

public record OwnerKpisDto(string Range, DashboardMoneyDto Sales, DashboardCountDto Orders, DashboardMoneyDto Ticket, DashboardPercentDto FreePct, DateTime? CompareDate);

/// <summary>KPI de Operaciones (R-24): el tipo no tiene ventas ni ticket.</summary>
public record OperationsKpisDto(string Range, DashboardCountDto Orders, DashboardPercentDto FreePct, DateTime? CompareDate);

public record DashboardDayDto(DateTime Date, decimal V, int Orders, int Free, decimal Prev, int PrevOrders, int PrevFree);

public record DashboardBarDto(string K, int V);

public record DashboardSizeDto(string K, string Code, int V);

public record DashboardEditionDto(int Id, string Name, int Edition, int Left, double Ratio, bool Low);

public record DashboardFewUnitsDto(string Slug, string Name, int Stock);

public record DashboardSeasonDto(string Slug, string Name, CollectionKind Kind, byte? StartMonth, byte? StartDay, byte? EndMonth, byte? EndDay, int Stock);

public record OwnerLineDto(ProductLine Line, int Units, decimal Revenue, double? Margin, int MissingCost);

public record OperationsLineDto(ProductLine Line, int Units);

public record DashboardBrandDto(string Slug, string Name, decimal Revenue, double Margin);

/// <summary>Por línea, en unidades (DESIGN_CATALOG_UI §4.2): Dueño con pesos y margen.</summary>
public record OwnerDashboardCatalogDto(
    IReadOnlyList<OwnerLineDto> Lines,
    double? GrossMargin,
    IReadOnlyList<DashboardBrandDto> Brands,
    int UnitsSold,
    IReadOnlyList<DashboardFewUnitsDto> FewUnits,
    IReadOnlyList<DashboardSeasonDto> Seasons,
    AdminToday Today);

public record OperationsDashboardCatalogDto(
    IReadOnlyList<OperationsLineDto> Lines,
    int UnitsSold,
    IReadOnlyList<DashboardFewUnitsDto> FewUnits,
    IReadOnlyList<DashboardSeasonDto> Seasons,
    AdminToday Today);

public record OwnerDashboardDto(
    DateTime Now,
    int Few,
    OwnerKpisDto Kpis,
    IReadOnlyDictionary<string, int> Queue,
    IReadOnlyList<InventoryRowDto> Alerts,
    IReadOnlyList<DashboardBarDto> Top,
    IReadOnlyList<DashboardSizeDto> Sizes,
    IReadOnlyList<DashboardEditionDto> Editions,
    IReadOnlyList<OwnerOrderDto> Recent,
    IReadOnlyList<DashboardDayDto> Daily,
    OwnerDashboardCatalogDto Catalog);

/// <summary>Dashboard de Operaciones (R-24): sin ventas por día, ticket, ingreso ni margen. Los tipos no tienen esos campos.</summary>
public record OperationsDashboardDto(
    DateTime Now,
    int Few,
    OperationsKpisDto Kpis,
    IReadOnlyDictionary<string, int> Queue,
    IReadOnlyList<InventoryRowDto> Alerts,
    IReadOnlyList<DashboardBarDto> Top,
    IReadOnlyList<DashboardSizeDto> Sizes,
    IReadOnlyList<DashboardEditionDto> Editions,
    IReadOnlyList<OperationsOrderDto> Recent,
    OperationsDashboardCatalogDto Catalog);
