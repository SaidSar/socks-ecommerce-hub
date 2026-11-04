using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad: único escritor de <c>Coupons</c> y <c>CouponRedemptions</c> (D-40).</summary>
public interface ICouponService
{
    /// <summary>
    /// El cupón si aplica a esta compra, o el motivo. Con <paramref name="forCheckout"/> bloquea la fila del cupón
    /// (<c>UPDLOCK, HOLDLOCK</c>) hasta el fin de la transacción: dos compras simultáneas no pasan el límite de usos.
    /// </summary>
    Task<CouponLookup> FindApplicableAsync(string? code, decimal subtotal, string? email, bool forCheckout, CancellationToken cancellationToken = default);

    /// <summary>Registra el uso del pedido. Va en la misma transacción que el pedido.</summary>
    Task RedeemAsync(int couponId, int orderId, string email, decimal discount, DateTime at, CancellationToken cancellationToken = default);

    /// <summary>Al cancelar un pedido libera su uso. El pedido conserva el código y el descuento como historial.</summary>
    Task ReleaseAsync(int orderId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminCouponDto>> ListAsync(CancellationToken cancellationToken = default);

    Task<AdminCouponDto?> GetAsync(int id, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminCouponDto>> CreateAsync(AdminCouponRequestDto request, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminCouponDto>> UpdateAsync(int id, AdminCouponRequestDto request, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminCouponDto>> SetActiveAsync(int id, bool active, CancellationToken cancellationToken = default);

    /// <summary>Solo si ningún pedido lo usó; si no, se desactiva.</summary>
    Task<AdminResult<bool>> DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public class CouponService(SokkoDbContext db, IClock clock) : ICouponService
{
    public const string NotFoundMessage = "No encontramos ese cupón.";
    public const string CodeTaken = "Ya existe un cupón con ese código.";
    public const string UsedCannotDelete = "Este cupón ya se usó en pedidos: desactívelo en lugar de borrarlo.";
    public const string UsedCodeLocked = "Este cupón ya se usó en pedidos: su código no se puede cambiar.";

    public async Task<CouponLookup> FindApplicableAsync(string? code, decimal subtotal, string? email, bool forCheckout, CancellationToken cancellationToken = default)
    {
        var normalized = CouponRules.Normalize(code);
        if (!CouponRules.IsValidCode(normalized))
        {
            return CouponLookup.Rejected(CouponRules.NotFoundRejection);
        }

        var coupon = forCheckout
            // El bloqueo serializa a quienes compran con este cupón; el conteo de abajo ya ve los usos confirmados.
            ? await db.Coupons.FromSqlInterpolated($"SELECT * FROM dbo.Coupons WITH (UPDLOCK, HOLDLOCK) WHERE Code = {normalized}").AsNoTracking().FirstOrDefaultAsync(cancellationToken)
            : await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == normalized, cancellationToken);
        if (coupon is null)
        {
            return CouponLookup.Rejected(CouponRules.NotFoundRejection);
        }

        var redemptions = coupon.MaxRedemptions is null ? 0 : await db.CouponRedemptions.CountAsync(r => r.CouponId == coupon.Id, cancellationToken);
        bool? usedByEmail = null;
        if (coupon.OnePerCustomer && !string.IsNullOrWhiteSpace(email))
        {
            var normalizedEmail = UserService.NormalizeEmail(email);
            usedByEmail = await db.CouponRedemptions.AnyAsync(r => r.CouponId == coupon.Id && r.CustomerEmail == normalizedEmail, cancellationToken);
        }

        var rejection = CouponRules.Check(coupon, clock.Today, subtotal, redemptions, usedByEmail);
        return rejection is null ? CouponLookup.Applies(coupon) : CouponLookup.Rejected(rejection);
    }

    public async Task RedeemAsync(int couponId, int orderId, string email, decimal discount, DateTime at, CancellationToken cancellationToken = default)
    {
        db.CouponRedemptions.Add(new CouponRedemption
        {
            CouponId = couponId, OrderId = orderId, CustomerEmail = UserService.NormalizeEmail(email), DiscountAmount = discount, CreatedAt = at,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task ReleaseAsync(int orderId, CancellationToken cancellationToken = default) =>
        db.CouponRedemptions.Where(r => r.OrderId == orderId).ExecuteDeleteAsync(cancellationToken);

    // --- Panel ---

    private sealed record Stats(int Redemptions, decimal DiscountGiven, decimal Sales);

    private async Task<Dictionary<int, Stats>> StatsAsync(IReadOnlyCollection<int> ids, CancellationToken cancellationToken) =>
        // Los usos solo existen para pedidos no cancelados: al cancelar se borran.
        (await db.CouponRedemptions
            .AsNoTracking()
            .Where(r => ids.Contains(r.CouponId))
            .GroupBy(r => r.CouponId)
            .Select(g => new { Id = g.Key, Count = g.Count(), Discount = g.Sum(r => r.DiscountAmount), Sales = g.Sum(r => r.Order.Total) })
            .ToListAsync(cancellationToken))
        .ToDictionary(x => x.Id, x => new Stats(x.Count, x.Discount, x.Sales));

    private Task<bool> EverUsedAsync(string code, CancellationToken cancellationToken) =>
        db.Orders.AnyAsync(o => o.CouponCode == code, cancellationToken);

    private async Task<List<string>> UsedCodesAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken) =>
        await db.Orders.AsNoTracking().Where(o => o.CouponCode != null && codes.Contains(o.CouponCode)).Select(o => o.CouponCode!).Distinct().ToListAsync(cancellationToken);

    private AdminCouponDto ToDto(Coupon c, Stats? stats, bool used) => new(
        c.Id, c.Code, c.Description, c.Type, c.Value, c.MinSubtotal, c.StartsOn, c.EndsOn, c.MaxRedemptions, c.OnePerCustomer, c.IsActive,
        CouponRules.StatusOf(c, clock.Today, stats?.Redemptions ?? 0),
        stats?.Redemptions ?? 0, stats?.DiscountGiven ?? 0, stats?.Sales ?? 0, !used,
        c.CreatedAt, c.UpdatedAt, c.RowVersion);

    public async Task<IReadOnlyList<AdminCouponDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var coupons = await db.Coupons.AsNoTracking().OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id).ToListAsync(cancellationToken);
        var stats = await StatsAsync(coupons.Select(c => c.Id).ToList(), cancellationToken);
        var used = (await UsedCodesAsync(coupons.Select(c => c.Code).ToList(), cancellationToken)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return coupons.Select(c => ToDto(c, stats.GetValueOrDefault(c.Id), used.Contains(c.Code))).ToList();
    }

    public async Task<AdminCouponDto?> GetAsync(int id, CancellationToken cancellationToken = default)
    {
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (coupon is null)
        {
            return null;
        }
        var stats = await StatsAsync([id], cancellationToken);
        return ToDto(coupon, stats.GetValueOrDefault(id), await EverUsedAsync(coupon.Code, cancellationToken));
    }

    /// <summary>Errores por campo con los mismos mensajes que la vista previa del panel.</summary>
    public static Dictionary<string, string> Validate(AdminCouponRequestDto r, string? code)
    {
        var errors = new Dictionary<string, string>();
        if (code is null)
        {
            errors["code"] = "Escriba el código.";
        }
        else if (!CouponRules.IsValidCode(code))
        {
            errors["code"] = "El código lleva de 3 a 30 letras sin acentos, números o guiones.";
        }

        switch (r.Type)
        {
            case null:
                errors["type"] = "Elija el tipo de descuento.";
                break;
            case CouponType.Percent when r.Value is not { } pct || pct < CouponRules.MinPercent || pct > CouponRules.MaxPercent || pct % 1 != 0:
                errors["value"] = $"El porcentaje va de {CouponRules.MinPercent} a {CouponRules.MaxPercent}, sin decimales.";
                break;
            case CouponType.Fixed when r.Value is not { } amount || amount <= 0 || decimal.Round(amount, 2) != amount || amount > 99999999.99m:
                errors["value"] = "Escriba un monto mayor que $0, con hasta dos decimales.";
                break;
        }

        if (r.MinSubtotal is { } min && (min <= 0 || decimal.Round(min, 2) != min || min > 99999999.99m))
        {
            errors["minSubtotal"] = "El mínimo de compra debe ser mayor que $0.";
        }
        if (r.StartsOn is { } starts && r.EndsOn is { } ends && ends < starts)
        {
            errors["endsOn"] = "La fecha final es anterior a la de inicio.";
        }
        if (r.MaxRedemptions is < 1)
        {
            errors["maxRedemptions"] = "El límite de usos debe ser 1 o más.";
        }
        return errors;
    }

    private static void Apply(Coupon coupon, AdminCouponRequestDto r, string code)
    {
        coupon.Code = code;
        coupon.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        coupon.Type = r.Type!.Value;
        coupon.Value = coupon.Type == CouponType.FreeShipping ? 0 : r.Value!.Value;
        coupon.MinSubtotal = r.MinSubtotal;
        coupon.StartsOn = r.StartsOn;
        coupon.EndsOn = r.EndsOn;
        coupon.MaxRedemptions = r.MaxRedemptions;
        coupon.OnePerCustomer = r.OnePerCustomer;
        coupon.IsActive = r.IsActive;
    }

    private static AdminResult<AdminCouponDto> Taken() =>
        AdminResult<AdminCouponDto>.Invalid(new Dictionary<string, string> { ["code"] = CodeTaken });

    public async Task<AdminResult<AdminCouponDto>> CreateAsync(AdminCouponRequestDto request, CancellationToken cancellationToken = default)
    {
        var code = CouponRules.Normalize(request.Code);
        var errors = Validate(request, code);
        if (errors.Count > 0)
        {
            return AdminResult<AdminCouponDto>.Invalid(errors);
        }
        if (await db.Coupons.AnyAsync(c => c.Code == code, cancellationToken))
        {
            return Taken();
        }

        var now = clock.UtcNow;
        var coupon = new Coupon { CreatedAt = now, UpdatedAt = now };
        Apply(coupon, request, code!);
        db.Coupons.Add(coupon);
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<AdminCouponDto>.Ok((await GetAsync(coupon.Id, cancellationToken))!);
    }

    public async Task<AdminResult<AdminCouponDto>> UpdateAsync(int id, AdminCouponRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request.RowVersion is null)
        {
            return AdminResult<AdminCouponDto>.Invalid(new Dictionary<string, string> { ["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage });
        }
        var code = CouponRules.Normalize(request.Code);
        var errors = Validate(request, code);
        if (errors.Count > 0)
        {
            return AdminResult<AdminCouponDto>.Invalid(errors);
        }

        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (coupon is null)
        {
            return AdminResult<AdminCouponDto>.NotFound(NotFoundMessage);
        }
        if (!coupon.RowVersion.SequenceEqual(request.RowVersion))
        {
            return AdminResult<AdminCouponDto>.Conflict(ConcurrencyExceptionFilter.StaleMessage);
        }
        if (code != coupon.Code)
        {
            // El código queda copiado en los pedidos: cambiarlo rompería la relación con su historial.
            if (await EverUsedAsync(coupon.Code, cancellationToken))
            {
                return AdminResult<AdminCouponDto>.Invalid(new Dictionary<string, string> { ["code"] = UsedCodeLocked });
            }
            if (await db.Coupons.AnyAsync(c => c.Code == code && c.Id != id, cancellationToken))
            {
                return Taken();
            }
        }

        db.Entry(coupon).Property(c => c.RowVersion).OriginalValue = request.RowVersion;
        Apply(coupon, request, code!);
        coupon.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<AdminCouponDto>.Ok((await GetAsync(id, cancellationToken))!);
    }

    public async Task<AdminResult<AdminCouponDto>> SetActiveAsync(int id, bool active, CancellationToken cancellationToken = default)
    {
        // Idempotente y sin RowVersion: activar o desactivar no pisa otros cambios de la fila.
        var rows = await db.Coupons.Where(c => c.Id == id)
            .ExecuteUpdateAsync(u => u.SetProperty(c => c.IsActive, active).SetProperty(c => c.UpdatedAt, clock.UtcNow), cancellationToken);
        return rows == 0
            ? AdminResult<AdminCouponDto>.NotFound(NotFoundMessage)
            : AdminResult<AdminCouponDto>.Ok((await GetAsync(id, cancellationToken))!);
    }

    public async Task<AdminResult<bool>> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (coupon is null)
        {
            return AdminResult<bool>.NotFound(NotFoundMessage);
        }
        if (await EverUsedAsync(coupon.Code, cancellationToken) || await db.CouponRedemptions.AnyAsync(r => r.CouponId == id, cancellationToken))
        {
            return AdminResult<bool>.Conflict(UsedCannotDelete);
        }
        await db.Coupons.Where(c => c.Id == id).ExecuteDeleteAsync(cancellationToken);
        return AdminResult<bool>.Ok(true);
    }
}
