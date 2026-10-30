using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.1.</summary>
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("Users", t =>
        {
            t.HasCheckConstraint("CK_Users_Role", SqlIn<UserRole>("Role"));
            t.HasCheckConstraint("CK_Users_CustomerAcceptedTerms", "[Role] <> 'Customer' OR [AcceptedTermsAt] IS NOT NULL");
            t.HasCheckConstraint("CK_Users_Email", "[Email] LIKE '_%@_%._%'");
        });

        b.Property(u => u.FirstName).HasMaxLength(80);
        b.Property(u => u.LastName).HasMaxLength(80);
        b.Property(u => u.Email).HasMaxLength(254);
        b.Property(u => u.PasswordHash).HasMaxLength(256);
        b.Property(u => u.Role).HasEnumColumn(20).HasDbDefault(UserRole.Customer);
        b.Property(u => u.MarketingOptIn).HasDbDefault(false);
        b.Property(u => u.IsActive).HasDbDefault(true);
        b.Property(u => u.CreatedAt).HasUtcNowDefault();
        b.Property(u => u.UpdatedAt).HasUtcNowDefault();

        b.HasIndex(u => u.Email).IsUnique().HasDatabaseName("UQ_Users_Email");
        b.HasIndex(u => u.Role).HasDatabaseName("IX_Users_Role").HasFilter("[Role] <> 'Customer'");

        b.HasOne(u => u.PreferredSize).WithMany()
            .HasForeignKey(u => u.PreferredSizeId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Users_Sizes");
    }
}
