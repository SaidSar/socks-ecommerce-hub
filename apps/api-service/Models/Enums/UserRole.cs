namespace Sokko.Api.Models.Enums;

/// <summary>Rol de la cuenta (`Users.Role`). En inglés porque es el contrato de `[Authorize(Roles = ...)]` (DESIGN_DB §1.1).</summary>
public enum UserRole
{
    Customer,
    Owner,
    Operations,
}
