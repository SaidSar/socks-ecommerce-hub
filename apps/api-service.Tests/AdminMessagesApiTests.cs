using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Models;

namespace Sokko.Api.Tests;

public class AdminMessagesApiTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    private const string Url = "/api/admin/messages";
    private const string Ip = "203.0.113.77";

    private readonly string _token = Guid.NewGuid().ToString("N")[..10];

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.ContactMessages.Where(m => m.Email.EndsWith($"{_token}@correo.test")).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private async Task<int> Add(string subject = "Mi pedido", string? message = null, int minutesAgo = 0)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var saved = new ContactMessage
        {
            Name = "Ana Prueba",
            Email = $"ana-{Guid.NewGuid():N}-{_token}@correo.test",
            Subject = subject,
            Message = message ?? $"¿Cuándo llega mi pedido SKK-1001? {_token}",
            IpAddress = Ip,
            CreatedAt = DateTime.UtcNow.AddMinutes(-minutesAgo),
        };
        db.ContactMessages.Add(saved);
        await db.SaveChangesAsync(Ct);
        return saved.Id;
    }

    private async Task<List<int>> Ids(string status, string? role = Owner) =>
        (await Json(await Get($"{Url}?status={status}&q={_token}", role))).GetProperty("messages").EnumerateArray().Select(m => m.GetProperty("id").GetInt32()).ToList();

    private async Task<int> Unread(string role = Owner) => (await Json(await Get($"{Url}/unread-count", role))).GetProperty("count").GetInt32();

    private async Task<ContactMessage> Saved(int id)
    {
        using var scope = Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SokkoDbContext>().ContactMessages.AsNoTracking().SingleAsync(m => m.Id == id, Ct);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.OK)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Inbox_is_for_both_staff_roles(string? role, HttpStatusCode expected)
    {
        Assert.Equal(expected, (await Get(Url, role)).StatusCode);
        Assert.Equal(expected, (await Get($"{Url}/unread-count", role)).StatusCode);
    }

    [Fact]
    public async Task Customers_cannot_change_a_message()
    {
        var id = await Add();
        Assert.Equal(HttpStatusCode.Forbidden, (await Post($"{Url}/{id}/read", Customer, new { })).StatusCode);
        Assert.Null((await Saved(id)).ReadAt);
    }

    [Fact]
    public async Task Unknown_status_gets_400_and_unknown_message_404()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Get($"{Url}?status=todos", Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"{Url}/99999999/read", Owner, new { })).StatusCode);
    }

    [Fact]
    public async Task Tabs_filter_by_state_newest_first_and_search()
    {
        var older = await Add(minutesAgo: 30);
        var newer = await Add();
        var read = await Add();
        var archived = await Add(subject: "Otro", message: $"Una pregunta sobre tallas {_token}");
        await Post($"{Url}/{read}/read", Owner, new { });
        await Post($"{Url}/{archived}/archive", Owner, new { });

        Assert.Equal([newer, older], await Ids("nuevos"));
        Assert.Equal([read], await Ids("leidos"));
        Assert.Equal([archived], await Ids("archivados"));

        var tallas = await Json(await Get($"{Url}?status=archivados&q=tallas {_token}", Owner));
        Assert.Equal(1, tallas.GetProperty("total").GetInt32());
        Assert.True(tallas.GetProperty("counts").GetProperty("nuevos").GetInt32() >= 2);
        Assert.Equal(25, tallas.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task Unread_count_follows_reading_and_archiving()
    {
        var before = await Unread();
        var first = await Add();
        var second = await Add();
        Assert.Equal(before + 2, await Unread(Operations));

        await Post($"{Url}/{first}/read", Operations, new { });
        await Post($"{Url}/{second}/archive", Operations, new { });
        Assert.Equal(before, await Unread());

        await Post($"{Url}/{first}/unread", Operations, new { });
        Assert.Equal(before + 1, await Unread());
        await Post($"{Url}/{second}/unarchive", Operations, new { });
        Assert.Equal(before + 2, await Unread());
    }

    [Fact]
    public async Task Transitions_are_idempotent_and_record_who_did_it()
    {
        var id = await Add();

        var first = await Json(await Post($"{Url}/{id}/read", Operations, new { }));
        var readAt = (await Saved(id)).ReadAt;
        Assert.NotNull(readAt);
        Assert.Equal("Daniel R.", first.GetProperty("handledBy").GetString());

        // Leerlo otra vez (ahora el Dueño) no cambia la fecha ni quién lo leyó.
        var again = await Post($"{Url}/{id}/read", Owner, new { });
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        var saved = await Saved(id);
        Assert.Equal(readAt, saved.ReadAt);
        Assert.Equal("Daniel R.", (await Json(again)).GetProperty("handledBy").GetString());

        var archived = await Json(await Post($"{Url}/{id}/archive", Owner, new { }));
        Assert.Equal("Aiko M.", archived.GetProperty("handledBy").GetString());
        Assert.NotEqual(JsonValueKind.Null, archived.GetProperty("archivedAt").ValueKind);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Url}/{id}/archive", Owner, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Url}/{id}/unarchive", Owner, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Post($"{Url}/{id}/unarchive", Owner, new { })).StatusCode);
        Assert.Null((await Saved(id)).ArchivedAt);
    }

    [Fact]
    public async Task Panel_never_sees_the_ip()
    {
        var id = await Add();

        var list = await (await Get($"{Url}?q={_token}", Operations)).Content.ReadAsStringAsync(Ct);
        var change = await (await Post($"{Url}/{id}/read", Operations, new { })).Content.ReadAsStringAsync(Ct);

        foreach (var body in new[] { list, change })
        {
            Assert.DoesNotContain(Ip, body);
            Assert.DoesNotContain("ipAddress", body, StringComparison.OrdinalIgnoreCase);
        }
        Assert.Contains("SKK-1001", list);
    }
}
