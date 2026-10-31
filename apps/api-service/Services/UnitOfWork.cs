using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;

namespace Sokko.Api.Services;

/// <summary>Transacción compartida por los servicios de entidad dentro de una tarea (DESIGN_DB §6).</summary>
public interface IUnitOfWork
{
    /// <summary>Corre <paramref name="work"/> en una transacción: confirma si devuelve <c>Commit = true</c> y revierte si no o si lanza.</summary>
    Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<(T Result, bool Commit)>> work, CancellationToken cancellationToken = default);
}

public class UnitOfWork(SokkoDbContext db) : IUnitOfWork
{
    public Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<(T Result, bool Commit)>> work, CancellationToken cancellationToken = default) =>
        // Con EnableRetryOnFailure, una transacción explícita tiene que ir dentro de la estrategia de ejecución.
        db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var (result, commit) = await work(cancellationToken);
            if (commit)
            {
                await transaction.CommitAsync(cancellationToken);
            }
            else
            {
                await transaction.RollbackAsync(cancellationToken);
            }
            db.ChangeTracker.Clear();
            return result;
        });
}
