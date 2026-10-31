using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Permisos del panel: mismos que <c>apps/admin-panel/src/config/roles.js</c>. El Dueño los tiene todos.</summary>
public static class Permissions
{
    public const string MoneyView = "money.view";
    public const string OrdersManage = "orders.manage";
    public const string InventoryAdjust = "inventory.adjust";
    public const string InventoryImport = "inventory.import";
    public const string SettingsManage = "settings.manage";
    public const string CatalogView = "catalog.view";
    public const string CatalogEdit = "catalog.edit";
    public const string BrandsEdit = "brands.edit";
    public const string CollectionsEdit = "collections.edit";
    public const string TypesEdit = "types.edit";
    public const string CostsView = "costs.view";
    public const string CustomersView = "customers.view";
    public const string FinanceView = "finance.view";
    public const string PromotionsManage = "promotions.manage";
    public const string ShippingView = "shipping.view";
    public const string PaymentsConfirm = "payments.confirm";

    /// <summary>Política para cualquier miembro del equipo interno.</summary>
    public const string Staff = "staff";

    public static readonly string[] All =
    [
        MoneyView, OrdersManage, InventoryAdjust, InventoryImport, SettingsManage, CatalogView, CatalogEdit, BrandsEdit,
        CollectionsEdit, TypesEdit, CostsView, CustomersView, FinanceView, PromotionsManage, ShippingView, PaymentsConfirm,
    ];

    private static readonly string[] OperationsPermissions = [OrdersManage, InventoryAdjust, ShippingView, CatalogView];

    public static bool IsStaff(UserRole role) => role is UserRole.Owner or UserRole.Operations;

    public static bool OperationsCan(string permission) => OperationsPermissions.Contains(permission);
}
