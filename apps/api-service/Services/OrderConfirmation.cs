using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Avisa al cliente que su pedido se creó. Corre después del commit: si el correo falla se registra y la compra sigue en pie.</summary>
public interface IOrderConfirmation
{
    Task SendAsync(string folio);
}

public class OrderConfirmation(IOrderService orders, IEmailSender email, IExpireOxxoOrders expiry, ILogger<OrderConfirmation> logger) : IOrderConfirmation
{
    public async Task SendAsync(string folio)
    {
        try
        {
            // Sin el token de la petición: que el cliente cierre la pestaña no cancela su correo.
            var order = await orders.FindByFolioAsync(folio, CancellationToken.None);
            if (order is null)
            {
                return;
            }

            var unpaidOxxo = order.PaymentMethod == PaymentMethod.OxxoPay && order.PaymentStatus == PaymentStatus.Pendiente;
            await email.SendOrderConfirmationAsync(
                new OrderConfirmationEmail(
                    order.CustomerEmail,
                    order.CustomerFirstName,
                    order.Folio,
                    order.Total,
                    unpaidOxxo ? order.PaymentReference : null,
                    unpaidOxxo ? order.CreatedAt + expiry.Lifetime : null,
                    order.Items.OrderBy(i => i.Id).Select(i => new OrderEmailLine(i.ProductNameSnapshot, i.ToneNameSnapshot, i.SizeCodeSnapshot, i.Quantity, i.Quantity * i.UnitPrice)).ToList()),
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "No se pudo enviar la confirmación del pedido {Folio}.", folio);
        }
    }
}
