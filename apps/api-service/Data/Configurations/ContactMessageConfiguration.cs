using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;

namespace Sokko.Api.Data.Configurations;

/// <summary>Mensajes de contacto. Sin FK: el remitente puede no tener cuenta.</summary>
public class ContactMessageConfiguration : IEntityTypeConfiguration<ContactMessage>
{
    public void Configure(EntityTypeBuilder<ContactMessage> b)
    {
        b.ToTable("ContactMessages", t => t.HasCheckConstraint("CK_ContactMessages_Message", "LEN([Message]) > 0"));

        b.Property(m => m.Name).HasMaxLength(ContactMessageLimits.Name);
        b.Property(m => m.Email).HasMaxLength(ContactMessageLimits.Email);
        b.Property(m => m.Subject).HasMaxLength(ContactMessageLimits.Subject);
        b.Property(m => m.Message).HasMaxLength(ContactMessageLimits.Message);
        b.Property(m => m.IpAddress).HasMaxLength(45).IsUnicode(false);
        b.Property(m => m.CreatedAt).HasUtcNowDefault();

        b.HasIndex(m => m.CreatedAt).HasDatabaseName("IX_ContactMessages_CreatedAt");
    }
}
