using System.Security.Cryptography;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary><c>Token</c> lo genera el navegador: el número de tarjeta nunca llega a este servicio.</summary>
public record PaymentRequest(PaymentMethod Method, decimal Amount, string? Token, string Folio, string IdempotencyKey);

/// <summary><c>Paid = false</c> con <c>Approved = true</c> es un cobro que queda pendiente, como una referencia OXXO.</summary>
public record PaymentResult(bool Approved, bool Paid, string? Reference, string? DeclineCode)
{
    public static PaymentResult Declined(string code) => new(false, false, null, code);
}

/// <summary>Proxy hacia la pasarela de pago: una pasarela real se conecta implementando esta interfaz.</summary>
public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default);

    /// <summary>Anula un cobro aprobado cuando el pedido no se pudo confirmar.</summary>
    Task VoidAsync(string reference, CancellationToken cancellationToken = default);
}

public static class PaymentDecline
{
    public const string Declined = "declined";
    public const string InsufficientFunds = "insufficient_funds";
}

/// <summary>Pasarela simulada (DESIGN_CHECKOUT §3.4): decide por el token que produce <c>services/paymentToken.js</c>.</summary>
public class FakePaymentGateway : IPaymentGateway
{
    public const string ApprovedToken = "tok_fake_approved";
    public const string DeclinedToken = "tok_fake_declined";
    public const string InsufficientFundsToken = "tok_fake_insufficient_funds";

    public Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Method == PaymentMethod.OxxoPay)
        {
            return Task.FromResult(new PaymentResult(true, false, OxxoReference(), null));
        }

        return Task.FromResult(request.Token switch
        {
            ApprovedToken => new PaymentResult(true, true, $"fake_ch_{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(12))}", null),
            InsufficientFundsToken => PaymentResult.Declined(PaymentDecline.InsufficientFunds),
            _ => PaymentResult.Declined(PaymentDecline.Declined),
        });
    }

    public Task VoidAsync(string reference, CancellationToken cancellationToken = default) => Task.CompletedTask;

    /// <summary>14 dígitos que empiezan en 93; se muestran en grupos de 4.</summary>
    private static string OxxoReference() =>
        "93" + string.Concat(Enumerable.Range(0, 12).Select(_ => RandomNumberGenerator.GetInt32(10)));
}
