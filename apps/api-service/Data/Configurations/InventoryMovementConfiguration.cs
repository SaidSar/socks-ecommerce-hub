using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.7. Kárdex de solo inserción (D-12).</summary>
public class InventoryMovementConfiguration : IEntityTypeConfiguration<InventoryMovement>
{
    public void Configure(EntityTypeBuilder<InventoryMovement> b)
    {
        b.ToTable("InventoryMovements", t =>
        {
            t.HasCheckConstraint("CK_InventoryMovements_Type", SqlIn<InventoryMovementType>("Type"));
            t.HasCheckConstraint("CK_InventoryMovements_Balance", "[Balance] >= 0");
            // El conteo y la importación fijan el stock: su delta puede ser +, − o 0.
            t.HasCheckConstraint("CK_InventoryMovements_Sign",
                "([Type] IN ('Entrada', 'Devolucion') AND [Quantity] > 0)"
                + " OR ([Type] IN ('Merma', 'Venta') AND [Quantity] < 0)"
                + " OR [Type] IN ('ConteoFisico', 'InventarioInicial')");
            // IS NOT NULL explícito: con Note = NULL, LEN(...) > 0 da UNKNOWN y un CHECK lo dejaría pasar.
            t.HasCheckConstraint("CK_InventoryMovements_NoteRequired",
                "[Type] NOT IN ('Merma', 'Devolucion') OR ([Note] IS NOT NULL AND LEN(LTRIM(RTRIM([Note]))) > 0)");
            t.HasCheckConstraint("CK_InventoryMovements_OrderRequired",
                "[Type] NOT IN ('Venta', 'Devolucion') OR [OrderId] IS NOT NULL");
        });

        b.Property(m => m.Type).HasEnumColumn(20);
        b.Property(m => m.Note).HasMaxLength(250);
        b.Property(m => m.CreatedByName).HasMaxLength(80);
        b.Property(m => m.CreatedAt).HasUtcNowDefault();

        b.HasIndex(m => new { m.VariantId, m.CreatedAt })
            .HasDatabaseName("IX_InventoryMovements_VariantId_CreatedAt")
            .IsDescending(false, true)
            .IncludeProperties(m => new { m.Type, m.Quantity, m.Balance, m.CreatedByName, m.Note });
        b.HasIndex(m => m.OrderId).HasDatabaseName("IX_InventoryMovements_OrderId").HasFilter("[OrderId] IS NOT NULL");
        b.HasIndex(m => m.CreatedByUserId).HasDatabaseName("IX_InventoryMovements_CreatedByUserId");

        b.HasOne(m => m.Variant).WithMany(v => v.Movements)
            .HasForeignKey(m => m.VariantId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_InventoryMovements_ProductVariants");
        b.HasOne(m => m.Order).WithMany()
            .HasForeignKey(m => m.OrderId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_InventoryMovements_Orders");
        b.HasOne(m => m.CreatedByUser).WithMany()
            .HasForeignKey(m => m.CreatedByUserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_InventoryMovements_Users");
    }
}
