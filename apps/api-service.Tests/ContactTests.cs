using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Logging.Abstractions;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Reglas del formulario de contacto que no necesitan BD: validación, plantilla y honeypot.</summary>
public class ContactTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static List<ValidationResult> Validate(ContactRequestDto dto)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(dto, new ValidationContext(dto), results, validateAllProperties: true);
        return results;
    }

    private static ContactRequestDto Valid(string? name = "Ana", string? email = "ana@sokko.test", string? subject = "Un pedido", string? message = "¿Cuándo llega mi pedido?") =>
        new() { Name = name, Email = email, Subject = subject, Message = message };

    [Fact]
    public void Complete_message_is_valid()
    {
        Assert.Empty(Validate(Valid()));
    }

    [Theory]
    [InlineData(null, "ana@sokko.test", "Un pedido", "Mensaje suficiente", "Name", "Escriba su nombre.")]
    [InlineData("Ana", "ana@sokko", "Un pedido", "Mensaje suficiente", "Email", "Revise el formato del correo, por ejemplo nombre@dominio.com.")]
    [InlineData("Ana", "ana@sokko.test", "", "Mensaje suficiente", "Subject", "Elija un asunto.")]
    [InlineData("Ana", "ana@sokko.test", "Un pedido", "Hola", "Message", "El mensaje necesita entre 10 y 2000 caracteres.")]
    public void Each_rule_reports_its_field_and_message(string? name, string? email, string? subject, string? message, string field, string error)
    {
        var result = Assert.Single(Validate(Valid(name, email, subject, message)));

        Assert.Equal([field], result.MemberNames);
        Assert.Equal(error, result.ErrorMessage);
    }

    [Fact]
    public void Message_longer_than_2000_characters_is_rejected()
    {
        Assert.Single(Validate(Valid(message: new string('a', 2001))));
    }

    [Fact]
    public void Notification_escapes_what_the_customer_wrote()
    {
        var parts = EmailTemplates.ContactNotification(new ContactNotificationEmail("tienda@sokko.test", "<b>Ana</b>", "ana@sokko.test", "Un pedido", "<script>x</script>"));

        Assert.Equal("Contacto: Un pedido", parts.Subject);
        Assert.DoesNotContain("<script>", parts.Html);
        Assert.Contains("&lt;script&gt;", parts.Html);
        Assert.Contains("&lt;b&gt;Ana&lt;/b&gt;", parts.Html);
        Assert.Contains("<script>x</script>", parts.Text);
    }

    [Fact]
    public async Task Filled_honeypot_is_dropped_without_touching_the_database_or_the_email()
    {
        // Contexto sin conexión real: si el servicio intentara guardar, la prueba fallaría.
        await using var db = TestDbContext.Create();
        var email = new CapturingEmailSender();
        var service = new SubmitContactMessage(db, email, new FakeClock(new DateOnly(2026, 11, 3)), NullLogger<SubmitContactMessage>.Instance);

        var saved = await service.SubmitAsync(new NewContactMessage("Bot", "bot@spam.test", "Otro tema", "Compre seguidores baratos", "https://spam.test", "203.0.113.9"), Ct);

        Assert.Null(saved);
        Assert.Empty(email.Contacts);
    }
}
