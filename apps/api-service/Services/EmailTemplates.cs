using System.Globalization;
using System.Net;

namespace Sokko.Api.Services;

public record EmailContentParts(string Subject, string Html, string Text);

/// <summary>Plantillas de correo. Todo lo que escribe el cliente pasa por <see cref="E"/>: un nombre no puede inyectar HTML.</summary>
public static class EmailTemplates
{
    private static readonly CultureInfo Mexico = CultureInfo.GetCultureInfo("es-MX");
    private static readonly TimeZoneInfo BusinessTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Mazatlan");

    private static string E(string text) => WebUtility.HtmlEncode(text);

    private static string Money(decimal amount) => amount.ToString("C2", Mexico);

    private static string Shell(string title, string body) =>
        $"""
        <div style="font-family:Georgia,serif;color:#23211E;max-width:560px;margin:0 auto;padding:24px">
          <p style="letter-spacing:.2em;font-size:13px;margin:0 0 24px">SOKKO</p>
          <h1 style="font-weight:400;font-size:24px;margin:0 0 16px">{E(title)}</h1>
          {body}
          <p style="color:#6A645C;font-size:12px;margin-top:32px">SOKKO · Confort que Renace cada paso</p>
        </div>
        """;

    private static string Button(string link, string label) =>
        $"""<p style="margin:24px 0"><a href="{E(link)}" style="background:#A62B2B;color:#fff;padding:12px 20px;text-decoration:none">{E(label)}</a></p>""";

    public static EmailContentParts PasswordReset(string link)
    {
        const string title = "Restablezca su contraseña";
        const string note = "El enlace vence en 30 minutos y solo sirve una vez. Si no lo pidió, ignore este correo: su contraseña no cambia.";
        return new EmailContentParts(
            "Restablezca su contraseña de SOKKO",
            Shell(title, $"<p>Use este enlace para crear una contraseña nueva.</p>{Button(link, "Crear contraseña nueva")}<p>{note}</p>"),
            $"{title}\n\n{link}\n\n{note}");
    }

    public static EmailContentParts Invitation(string link)
    {
        const string title = "Le invitaron al panel de SOKKO";
        const string note = "El enlace vence en 72 horas y solo sirve una vez.";
        return new EmailContentParts(
            title,
            Shell(title, $"<p>Cree su contraseña para entrar al panel del equipo.</p>{Button(link, "Crear mi contraseña")}<p>{note}</p>"),
            $"{title}\n\nCree su contraseña: {link}\n\n{note}");
    }

    public static EmailContentParts OrderConfirmation(OrderConfirmationEmail order)
    {
        var lines = string.Concat(order.Lines.Select(l =>
            $"""<tr><td style="padding:6px 0">{l.Quantity} × {E(l.Name)}<br><small>{E(l.Tone)} · Talla {E(l.Size)}</small></td><td style="text-align:right">{Money(l.LineTotal)}</td></tr>"""));
        var textLines = string.Join('\n', order.Lines.Select(l => $"{l.Quantity} × {l.Name} ({l.Tone}, talla {l.Size}): {Money(l.LineTotal)}"));

        string payHtml;
        string payText;
        if (order.OxxoReference is { } reference)
        {
            var until = order.OxxoExpiresAt is { } expires
                ? TimeZoneInfo.ConvertTimeFromUtc(expires, BusinessTimeZone).ToString("d 'de' MMMM, HH:mm", Mexico)
                : null;
            var limit = until is null ? "" : $" antes del {until} (hora de Sinaloa)";
            payHtml = $"<p>Pague {Money(order.Total)} en cualquier OXXO{limit}. Prepararemos su pedido cuando se confirme el pago.</p><p style=\"font-size:20px;letter-spacing:.1em\">Referencia: <b>{E(reference)}</b></p>";
            payText = $"Pague {Money(order.Total)} en cualquier OXXO{limit}.\nReferencia: {reference}\nPrepararemos su pedido cuando se confirme el pago.";
        }
        else
        {
            payHtml = "<p>Su pago con tarjeta se registró. Ya estamos preparando su pedido.</p>";
            payText = "Su pago con tarjeta se registró. Ya estamos preparando su pedido.";
        }

        var title = $"Gracias, {order.FirstName}";
        var body = $"""
            <p>Recibimos su pedido <b>{E(order.Folio)}</b>.</p>
            {payHtml}
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">{lines}
            <tr><td style="padding-top:12px;border-top:1px solid #DDD5CA"><b>Total, IVA incluido</b></td><td style="padding-top:12px;border-top:1px solid #DDD5CA;text-align:right"><b>{Money(order.Total)}</b></td></tr></table>
            """;
        return new EmailContentParts(
            $"Pedido {order.Folio} confirmado",
            Shell(title, body),
            $"{title}\n\nRecibimos su pedido {order.Folio}.\n\n{payText}\n\n{textLines}\nTotal, IVA incluido: {Money(order.Total)}");
    }
}
