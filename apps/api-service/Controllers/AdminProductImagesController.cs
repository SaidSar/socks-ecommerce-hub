using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Fotos de producto del panel. Las edita quien edita productos: solo el Dueño.</summary>
[Route("api/admin/products/{id:int}/images")]
[Authorize(Policy = Permissions.CatalogEdit)]
public class AdminProductImagesController(IProductImageService images) : AdminControllerBase
{
    // Holgura para el resto del formulario multipart; el límite de la foto (5 MB) lo revisa el servicio y responde 413.
    private const long MaxRequestBytes = ProductImageService.MaxBytes + 64 * 1024;

    [HttpPost]
    [ReadFormInAction]
    [RequestSizeLimit(MaxRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxRequestBytes)]
    public async Task<IActionResult> Upload(int id, CancellationToken cancellationToken)
    {
        // Antes de leer el cuerpo: sin almacenamiento, cualquier subida es 503, aunque el archivo sea inválido.
        if (!images.CanStore)
        {
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: UnconfiguredImageStorage.Message);
        }
        if (Request.ContentLength > MaxRequestBytes)
        {
            return TooLarge();
        }
        if (!Request.HasFormContentType)
        {
            return FileRequired();
        }

        IFormCollection form;
        try
        {
            form = await Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            // El formulario pasó de MultipartBodyLengthLimit.
            return TooLarge();
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return TooLarge();
        }

        var file = form.Files.GetFile("file");
        if (file is null)
        {
            return FileRequired();
        }
        await using var content = file.OpenReadStream();
        var result = await images.AddAsync(id, content, file.Length, form["altText"], cancellationToken);
        return result.Outcome == AdminOutcome.Ok
            ? Created($"/api/admin/products/{id}/images", result.Value)
            : FailureOf(result);
    }

    [HttpDelete("{imageId:int}")]
    public async Task<IActionResult> Delete(int id, int imageId, CancellationToken cancellationToken)
    {
        var result = await images.DeleteAsync(id, imageId, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }

    [HttpPut("order")]
    public async Task<IActionResult> Reorder(int id, ImageOrderRequestDto request, CancellationToken cancellationToken)
    {
        var result = await images.ReorderAsync(id, request.ImageIds, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }

    [HttpPut("{imageId:int}")]
    public async Task<IActionResult> AltText(int id, int imageId, ImageAltTextRequestDto request, CancellationToken cancellationToken)
    {
        var result = await images.SetAltTextAsync(id, imageId, request.AltText, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }

    private ObjectResult TooLarge() => Problem(statusCode: StatusCodes.Status413PayloadTooLarge, title: "La foto pesa más de 5 MB.");

    private ActionResult FileRequired()
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError("file", "Elige una foto.");
        return ValidationProblem(modelState);
    }
}

/// <summary>
/// Quita los proveedores de valores de formulario: si no, el enlace de modelos lee el formulario antes que la acción y un archivo
/// demasiado grande sale como 400 en vez de 413.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class ReadFormInActionAttribute : Attribute, IResourceFilter
{
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        var factories = context.ValueProviderFactories;
        factories.RemoveType<FormValueProviderFactory>();
        factories.RemoveType<FormFileValueProviderFactory>();
        factories.RemoveType<JQueryFormValueProviderFactory>();
    }

    public void OnResourceExecuted(ResourceExecutedContext context)
    {
    }
}
