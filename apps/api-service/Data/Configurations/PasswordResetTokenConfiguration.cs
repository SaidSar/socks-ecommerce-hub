using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.2. Única FK con <c>CASCADE</c> (D-07): el token no tiene valor de auditoría.</summary>
public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> b)
    {
        b.ToTable("PasswordResetTokens", t =>
            t.HasCheckConstraint("CK_PasswordResetTokens_Expiry", "[ExpiresAt] > [CreatedAt]"));

        b.Property(p => p.TokenHash).HasMaxLength(32);
        b.Property(p => p.CreatedAt).HasUtcNowDefault();

        b.HasIndex(p => p.TokenHash).IsUnique().HasDatabaseName("UQ_PasswordResetTokens_TokenHash");
        b.HasIndex(p => new { p.UserId, p.ExpiresAt }).HasDatabaseName("IX_PasswordResetTokens_UserId_ExpiresAt");

        b.HasOne(p => p.User).WithMany(u => u.PasswordResetTokens)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("FK_PasswordResetTokens_Users");
    }
}
