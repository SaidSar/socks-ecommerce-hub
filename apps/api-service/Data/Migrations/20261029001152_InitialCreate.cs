using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.CreateSequence<int>(
                name: "OrderFolioSeq",
                schema: "dbo",
                startValue: 1001L);

            // DESIGN_DB §1.5: NO CACHE para no perder folios tras un reinicio. EF Core no lo modela.
            migrationBuilder.Sql("ALTER SEQUENCE [dbo].[OrderFolioSeq] NO CACHE;");

            migrationBuilder.CreateTable(
                name: "Brands",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    Slug = table.Column<string>(type: "varchar(60)", unicode: false, maxLength: 60, nullable: false),
                    IsOwnBrand = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                        .Annotation("Relational:DefaultConstraintName", "DF_Brands_IsOwnBrand"),
                    ShowInFilters = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Brands_ShowInFilters"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Brands_IsActive"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Brands_CreatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Brands", x => x.Id);
                    table.CheckConstraint("CK_Brands_Slug", "[Slug] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9-]%'");
                });

            migrationBuilder.CreateTable(
                name: "Collections",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Slug = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: false),
                    Kind = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    StartMonth = table.Column<byte>(type: "tinyint", nullable: true),
                    StartDay = table.Column<byte>(type: "tinyint", nullable: true),
                    EndMonth = table.Column<byte>(type: "tinyint", nullable: true),
                    EndDay = table.Column<byte>(type: "tinyint", nullable: true),
                    StartKey = table.Column<int>(type: "int", nullable: true, computedColumnSql: "[StartMonth] * 100 + [StartDay]", stored: true),
                    EndKey = table.Column<int>(type: "int", nullable: true, computedColumnSql: "[EndMonth] * 100 + [EndDay]", stored: true),
                    OffSeasonDiscountPct = table.Column<decimal>(type: "decimal(5,4)", precision: 5, scale: 4, nullable: false, defaultValue: 0.30m)
                        .Annotation("Relational:DefaultConstraintName", "DF_Collections_OffSeasonDiscountPct"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Collections_IsActive"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Collections_CreatedAt"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Collections_UpdatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Collections", x => x.Id);
                    table.CheckConstraint("CK_Collections_Discount", "[OffSeasonDiscountPct] >= 0 AND [OffSeasonDiscountPct] < 1");
                    table.CheckConstraint("CK_Collections_EndDay", "[EndDay] IS NULL OR ([EndDay] >= 1 AND (([EndMonth] IN (1, 3, 5, 7, 8, 10, 12) AND [EndDay] <= 31) OR ([EndMonth] IN (4, 6, 9, 11) AND [EndDay] <= 30) OR ([EndMonth] = 2 AND [EndDay] <= 28)))");
                    table.CheckConstraint("CK_Collections_EndMonth", "[EndMonth] IS NULL OR [EndMonth] BETWEEN 1 AND 12");
                    table.CheckConstraint("CK_Collections_Kind", "[Kind] IN ('Temporada', 'Tematica')");
                    table.CheckConstraint("CK_Collections_Slug", "[Slug] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9-]%'");
                    table.CheckConstraint("CK_Collections_StartDay", "[StartDay] IS NULL OR ([StartDay] >= 1 AND (([StartMonth] IN (1, 3, 5, 7, 8, 10, 12) AND [StartDay] <= 31) OR ([StartMonth] IN (4, 6, 9, 11) AND [StartDay] <= 30) OR ([StartMonth] = 2 AND [StartDay] <= 28)))");
                    table.CheckConstraint("CK_Collections_StartMonth", "[StartMonth] IS NULL OR [StartMonth] BETWEEN 1 AND 12");
                    table.CheckConstraint("CK_Collections_Window", "([Kind] = 'Tematica' AND [StartMonth] IS NULL AND [StartDay] IS NULL AND [EndMonth] IS NULL AND [EndDay] IS NULL) OR ([Kind] = 'Temporada' AND [StartMonth] IS NOT NULL AND [StartDay] IS NOT NULL AND [EndMonth] IS NOT NULL AND [EndDay] IS NOT NULL)");
                });

            migrationBuilder.CreateTable(
                name: "Colors",
                schema: "dbo",
                columns: table => new
                {
                    Code = table.Column<string>(type: "char(3)", unicode: false, fixedLength: true, maxLength: 3, nullable: false),
                    Slug = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Hex = table.Column<string>(type: "char(7)", unicode: false, fixedLength: true, maxLength: 7, nullable: true),
                    LineHex = table.Column<string>(type: "char(7)", unicode: false, fixedLength: true, maxLength: 7, nullable: true),
                    IsSokkoTone = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                        .Annotation("Relational:DefaultConstraintName", "DF_Colors_IsSokkoTone"),
                    SortOrder = table.Column<byte>(type: "tinyint", nullable: false, defaultValue: (byte)0)
                        .Annotation("Relational:DefaultConstraintName", "DF_Colors_SortOrder"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Colors_IsActive")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Colors", x => x.Code);
                    table.CheckConstraint("CK_Colors_Code", "[Code] COLLATE Latin1_General_100_BIN2 LIKE '[A-Z][A-Z][A-Z]'");
                    table.CheckConstraint("CK_Colors_Hex", "[Hex] IS NULL OR [Hex] COLLATE Latin1_General_100_BIN2 LIKE '#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'");
                    table.CheckConstraint("CK_Colors_LineHex", "[LineHex] IS NULL OR [LineHex] COLLATE Latin1_General_100_BIN2 LIKE '#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'");
                    table.CheckConstraint("CK_Colors_Slug", "[Slug] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9-]%'");
                });

            migrationBuilder.CreateTable(
                name: "LocalDeliveryZones",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PostalCodeFrom = table.Column<string>(type: "char(5)", unicode: false, fixedLength: true, maxLength: 5, nullable: false),
                    PostalCodeTo = table.Column<string>(type: "char(5)", unicode: false, fixedLength: true, maxLength: 5, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    IsConfirmed = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_LocalDeliveryZones_IsConfirmed"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_LocalDeliveryZones_IsActive"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_LocalDeliveryZones_CreatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocalDeliveryZones", x => x.Id);
                    table.CheckConstraint("CK_LocalDeliveryZones_PostalCodeFrom", "[PostalCodeFrom] LIKE '[0-9][0-9][0-9][0-9][0-9]'");
                    table.CheckConstraint("CK_LocalDeliveryZones_PostalCodeTo", "[PostalCodeTo] LIKE '[0-9][0-9][0-9][0-9][0-9]'");
                    table.CheckConstraint("CK_LocalDeliveryZones_Range", "[PostalCodeFrom] <= [PostalCodeTo]");
                });

            migrationBuilder.CreateTable(
                name: "ProductTypes",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    SizeSystem = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    UnitLabel = table.Column<string>(type: "varchar(6)", unicode: false, maxLength: 6, nullable: false, defaultValue: "Pieza")
                        .Annotation("Relational:DefaultConstraintName", "DF_ProductTypes_UnitLabel"),
                    SortOrder = table.Column<byte>(type: "tinyint", nullable: false, defaultValue: (byte)0)
                        .Annotation("Relational:DefaultConstraintName", "DF_ProductTypes_SortOrder"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ProductTypes_IsActive")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductTypes", x => x.Id);
                    table.CheckConstraint("CK_ProductTypes_Code", "[Code] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9-]%'");
                    table.CheckConstraint("CK_ProductTypes_SizeSystem", "[SizeSystem] IN ('Calceta', 'Guante', 'Unitalla')");
                    table.CheckConstraint("CK_ProductTypes_UnitLabel", "[UnitLabel] IN ('Par', 'Pieza')");
                });

            migrationBuilder.CreateTable(
                name: "Sizes",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SizeSystem = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    Code = table.Column<string>(type: "varchar(3)", unicode: false, maxLength: 3, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<byte>(type: "tinyint", nullable: false, defaultValue: (byte)0)
                        .Annotation("Relational:DefaultConstraintName", "DF_Sizes_SortOrder"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Sizes_IsActive")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sizes", x => x.Id);
                    table.CheckConstraint("CK_Sizes_Code", "[Code] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z0-9]%'");
                    table.CheckConstraint("CK_Sizes_SizeSystem", "[SizeSystem] IN ('Calceta', 'Guante', 'Unitalla')");
                });

            migrationBuilder.CreateTable(
                name: "Products",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Line = table.Column<string>(type: "varchar(12)", unicode: false, maxLength: 12, nullable: false),
                    PieceNumber = table.Column<short>(type: "smallint", nullable: false),
                    Slug = table.Column<string>(type: "varchar(120)", unicode: false, maxLength: 120, nullable: false),
                    BrandId = table.Column<int>(type: "int", nullable: false),
                    ProductTypeId = table.Column<int>(type: "int", nullable: false),
                    CollectionId = table.Column<int>(type: "int", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    NameJp = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Material = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Price = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    UnitsPerPack = table.Column<byte>(type: "tinyint", nullable: false, defaultValue: (byte)1)
                        .Annotation("Relational:DefaultConstraintName", "DF_Products_UnitsPerPack"),
                    EditionSize = table.Column<int>(type: "int", nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Products_IsActive"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Products_CreatedAt"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Products_UpdatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.CheckConstraint("CK_Products_CollectionRequired", "[Line] <> 'Especiales' OR [CollectionId] IS NOT NULL");
                    table.CheckConstraint("CK_Products_EditionSize", "[EditionSize] IS NULL OR [EditionSize] > 0");
                    table.CheckConstraint("CK_Products_Line", "[Line] IN ('Sokko', 'Marcas', 'Especiales', 'Accesorios')");
                    table.CheckConstraint("CK_Products_NameJp", "[Line] <> 'Sokko' OR [NameJp] IS NOT NULL");
                    table.CheckConstraint("CK_Products_PieceNumber", "[PieceNumber] BETWEEN 1 AND 999");
                    table.CheckConstraint("CK_Products_Price", "[Price] > 0");
                    table.CheckConstraint("CK_Products_Slug", "[Slug] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-z0-9-]%'");
                    table.CheckConstraint("CK_Products_UnitsPerPack", "[UnitsPerPack] BETWEEN 1 AND 24");
                    table.ForeignKey(
                        name: "FK_Products_Brands",
                        column: x => x.BrandId,
                        principalSchema: "dbo",
                        principalTable: "Brands",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Products_Collections",
                        column: x => x.CollectionId,
                        principalSchema: "dbo",
                        principalTable: "Collections",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Products_ProductTypes",
                        column: x => x.ProductTypeId,
                        principalSchema: "dbo",
                        principalTable: "ProductTypes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FirstName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Role = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false, defaultValue: "Customer")
                        .Annotation("Relational:DefaultConstraintName", "DF_Users_Role"),
                    PreferredSizeId = table.Column<int>(type: "int", nullable: true),
                    MarketingOptIn = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                        .Annotation("Relational:DefaultConstraintName", "DF_Users_MarketingOptIn"),
                    AcceptedTermsAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    EmailConfirmedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Users_IsActive"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Users_CreatedAt"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Users_UpdatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.CheckConstraint("CK_Users_CustomerAcceptedTerms", "[Role] <> 'Customer' OR [AcceptedTermsAt] IS NOT NULL");
                    table.CheckConstraint("CK_Users_Email", "[Email] LIKE '_%@_%._%'");
                    table.CheckConstraint("CK_Users_Role", "[Role] IN ('Customer', 'Owner', 'Operations')");
                    table.ForeignKey(
                        name: "FK_Users_Sizes",
                        column: x => x.PreferredSizeId,
                        principalSchema: "dbo",
                        principalTable: "Sizes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ProductVariants",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    ColorCode = table.Column<string>(type: "char(3)", unicode: false, fixedLength: true, maxLength: 3, nullable: false),
                    SizeId = table.Column<int>(type: "int", nullable: false),
                    Sku = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Barcode = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: true),
                    UnitCost = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    Stock = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                        .Annotation("Relational:DefaultConstraintName", "DF_ProductVariants_Stock"),
                    Reserved = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                        .Annotation("Relational:DefaultConstraintName", "DF_ProductVariants_Reserved"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ProductVariants_IsActive"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariants", x => x.Id);
                    table.CheckConstraint("CK_ProductVariants_Barcode", "[Barcode] IS NULL OR [Barcode] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9A-Za-z]%'");
                    table.CheckConstraint("CK_ProductVariants_Reserved", "[Reserved] >= 0");
                    table.CheckConstraint("CK_ProductVariants_ReservedLeStock", "[Reserved] <= [Stock]");
                    table.CheckConstraint("CK_ProductVariants_SkuFormat", "LEFT([Sku], 4) IN ('SKK-', 'MRC-', 'ESP-', 'ACC-') AND ([Sku] COLLATE Latin1_General_100_BIN2 LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]-[A-Z][A-Z][A-Z]-[A-Z0-9]' OR [Sku] COLLATE Latin1_General_100_BIN2 LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]-[A-Z][A-Z][A-Z]-[A-Z0-9][A-Z0-9]' OR [Sku] COLLATE Latin1_General_100_BIN2 LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]-[A-Z][A-Z][A-Z]-[A-Z0-9][A-Z0-9][A-Z0-9]')");
                    table.CheckConstraint("CK_ProductVariants_Stock", "[Stock] >= 0");
                    table.CheckConstraint("CK_ProductVariants_UnitCost", "[UnitCost] IS NULL OR [UnitCost] >= 0");
                    table.ForeignKey(
                        name: "FK_ProductVariants_Colors",
                        column: x => x.ColorCode,
                        principalSchema: "dbo",
                        principalTable: "Colors",
                        principalColumn: "Code");
                    table.ForeignKey(
                        name: "FK_ProductVariants_Products",
                        column: x => x.ProductId,
                        principalSchema: "dbo",
                        principalTable: "Products",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ProductVariants_Sizes",
                        column: x => x.SizeId,
                        principalSchema: "dbo",
                        principalTable: "Sizes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Orders",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FolioNumber = table.Column<int>(type: "int", nullable: false, defaultValueSql: "NEXT VALUE FOR [dbo].[OrderFolioSeq]")
                        .Annotation("Relational:DefaultConstraintName", "DF_Orders_FolioNumber"),
                    Folio = table.Column<string>(type: "varchar(14)", unicode: false, maxLength: 14, nullable: false, computedColumnSql: "'SKK-' + CAST([FolioNumber] AS VARCHAR(10))", stored: true),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    CustomerFirstName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    CustomerLastName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    CustomerEmail = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    CustomerPhone = table.Column<string>(type: "varchar(15)", unicode: false, maxLength: 15, nullable: false),
                    ShipStreet = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ShipNeighborhood = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ShipCity = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ShipState = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ShipPostalCode = table.Column<string>(type: "char(5)", unicode: false, fixedLength: true, maxLength: 5, nullable: false),
                    ShipReferences = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    DeliveryMethod = table.Column<string>(type: "varchar(12)", unicode: false, maxLength: 12, nullable: false),
                    Status = table.Column<string>(type: "varchar(15)", unicode: false, maxLength: 15, nullable: false, defaultValue: "PorPreparar")
                        .Annotation("Relational:DefaultConstraintName", "DF_Orders_Status"),
                    PaymentMethod = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    PaymentStatus = table.Column<string>(type: "varchar(12)", unicode: false, maxLength: 12, nullable: false, defaultValue: "Pendiente")
                        .Annotation("Relational:DefaultConstraintName", "DF_Orders_PaymentStatus"),
                    PaymentReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaidAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true),
                    Subtotal = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    ShippingCost = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    TaxRate = table.Column<decimal>(type: "decimal(5,4)", precision: 5, scale: 4, nullable: false),
                    TaxIncluded = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false, computedColumnSql: "CAST(ROUND([Total] - [Total] / (1 + [TaxRate]), 2) AS DECIMAL(10, 2))", stored: true),
                    GiftWrap = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Orders_GiftWrap"),
                    InternalNote = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Orders_CreatedAt"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Orders_UpdatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => x.Id);
                    table.CheckConstraint("CK_Orders_DeliveryMethod", "[DeliveryMethod] IN ('Local', 'Paqueteria')");
                    table.CheckConstraint("CK_Orders_FolioNumber", "[FolioNumber] >= 1000");
                    table.CheckConstraint("CK_Orders_PaidAt", "[PaymentStatus] = 'Pendiente' OR [PaidAt] IS NOT NULL");
                    table.CheckConstraint("CK_Orders_PaymentBeforeFulfillment", "[PaymentStatus] = 'Pagado' OR [Status] IN ('PorPreparar', 'Cancelado')");
                    table.CheckConstraint("CK_Orders_PaymentMethod", "[PaymentMethod] IN ('Tarjeta', 'OxxoPay')");
                    table.CheckConstraint("CK_Orders_PaymentStatus", "[PaymentStatus] IN ('Pendiente', 'Pagado', 'Reembolsado')");
                    table.CheckConstraint("CK_Orders_PostalCode", "[ShipPostalCode] LIKE '[0-9][0-9][0-9][0-9][0-9]'");
                    table.CheckConstraint("CK_Orders_ShippingCost", "[ShippingCost] >= 0");
                    table.CheckConstraint("CK_Orders_Status", "[Status] IN ('PorPreparar', 'Preparando', 'Enviado', 'EnRuta', 'Entregado', 'Cancelado')");
                    table.CheckConstraint("CK_Orders_StatusMatchesDelivery", "NOT ([Status] = 'Enviado' AND [DeliveryMethod] = 'Local') AND NOT ([Status] = 'EnRuta' AND [DeliveryMethod] = 'Paqueteria')");
                    table.CheckConstraint("CK_Orders_Subtotal", "[Subtotal] >= 0");
                    table.CheckConstraint("CK_Orders_TaxRate", "[TaxRate] BETWEEN 0 AND 1");
                    table.CheckConstraint("CK_Orders_Total", "[Total] = [Subtotal] + [ShippingCost]");
                    table.ForeignKey(
                        name: "FK_Orders_Users",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TokenHash = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_PasswordResetTokens_CreatedAt"),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                    table.CheckConstraint("CK_PasswordResetTokens_Expiry", "[ExpiresAt] > [CreatedAt]");
                    table.ForeignKey(
                        name: "FK_PasswordResetTokens_Users",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Settings",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<byte>(type: "tinyint", nullable: false),
                    FreeShippingThreshold = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    ParcelShippingCost = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    LocalShippingCost = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    LocalFreeShipping = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Settings_LocalFreeShipping"),
                    FewUnitsThreshold = table.Column<int>(type: "int", nullable: false),
                    IvaRate = table.Column<decimal>(type: "decimal(5,4)", precision: 5, scale: 4, nullable: false),
                    FeaturedProductId = table.Column<int>(type: "int", nullable: true),
                    UpdatedByUserId = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Settings_UpdatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Settings", x => x.Id);
                    table.CheckConstraint("CK_Settings_FewUnitsThreshold", "[FewUnitsThreshold] >= 0");
                    table.CheckConstraint("CK_Settings_FreeShippingThreshold", "[FreeShippingThreshold] > 0");
                    table.CheckConstraint("CK_Settings_IvaRate", "[IvaRate] BETWEEN 0 AND 1");
                    table.CheckConstraint("CK_Settings_LocalShippingCost", "[LocalShippingCost] >= 0");
                    table.CheckConstraint("CK_Settings_ParcelShippingCost", "[ParcelShippingCost] >= 0");
                    table.CheckConstraint("CK_Settings_Singleton", "[Id] = 1");
                    table.ForeignKey(
                        name: "FK_Settings_Products",
                        column: x => x.FeaturedProductId,
                        principalSchema: "dbo",
                        principalTable: "Products",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Settings_Users",
                        column: x => x.UpdatedByUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "InventoryMovements",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VariantId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Balance = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    OrderId = table.Column<int>(type: "int", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_InventoryMovements_CreatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryMovements", x => x.Id);
                    table.CheckConstraint("CK_InventoryMovements_Balance", "[Balance] >= 0");
                    table.CheckConstraint("CK_InventoryMovements_NoteRequired", "[Type] NOT IN ('Merma', 'Devolucion') OR ([Note] IS NOT NULL AND LEN(LTRIM(RTRIM([Note]))) > 0)");
                    table.CheckConstraint("CK_InventoryMovements_OrderRequired", "[Type] NOT IN ('Venta', 'Devolucion') OR [OrderId] IS NOT NULL");
                    table.CheckConstraint("CK_InventoryMovements_Sign", "([Type] IN ('Entrada', 'Devolucion') AND [Quantity] > 0) OR ([Type] IN ('Merma', 'Venta') AND [Quantity] < 0) OR [Type] IN ('ConteoFisico', 'InventarioInicial')");
                    table.CheckConstraint("CK_InventoryMovements_Type", "[Type] IN ('Entrada', 'Merma', 'Devolucion', 'ConteoFisico', 'Venta', 'InventarioInicial')");
                    table.ForeignKey(
                        name: "FK_InventoryMovements_Orders",
                        column: x => x.OrderId,
                        principalSchema: "dbo",
                        principalTable: "Orders",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_InventoryMovements_ProductVariants",
                        column: x => x.VariantId,
                        principalSchema: "dbo",
                        principalTable: "ProductVariants",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_InventoryMovements_Users",
                        column: x => x.CreatedByUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "OrderItems",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    VariantId = table.Column<int>(type: "int", nullable: false),
                    SkuSnapshot = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    ProductNameSnapshot = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    ToneNameSnapshot = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    SizeCodeSnapshot = table.Column<string>(type: "varchar(3)", unicode: false, maxLength: 3, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    LineTotal = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false, computedColumnSql: "CAST([Quantity] * [UnitPrice] AS DECIMAL(10, 2))", stored: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderItems", x => x.Id);
                    table.CheckConstraint("CK_OrderItems_Quantity", "[Quantity] > 0");
                    table.CheckConstraint("CK_OrderItems_UnitPrice", "[UnitPrice] >= 0");
                    table.ForeignKey(
                        name: "FK_OrderItems_Orders",
                        column: x => x.OrderId,
                        principalSchema: "dbo",
                        principalTable: "Orders",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderItems_ProductVariants",
                        column: x => x.VariantId,
                        principalSchema: "dbo",
                        principalTable: "ProductVariants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "OrderStatusHistory",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(15)", unicode: false, maxLength: 15, nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_OrderStatusHistory_ChangedAt"),
                    ChangedByUserId = table.Column<int>(type: "int", nullable: true),
                    ChangedByName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderStatusHistory", x => x.Id);
                    table.CheckConstraint("CK_OrderStatusHistory_Status", "[Status] IN ('PorPreparar', 'Preparando', 'Enviado', 'EnRuta', 'Entregado', 'Cancelado', 'Pagado')");
                    table.ForeignKey(
                        name: "FK_OrderStatusHistory_Orders",
                        column: x => x.OrderId,
                        principalSchema: "dbo",
                        principalTable: "Orders",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderStatusHistory_Users",
                        column: x => x.ChangedByUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Shipments",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    DeliveryMethod = table.Column<string>(type: "varchar(12)", unicode: false, maxLength: 12, nullable: false),
                    Carrier = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: true),
                    TrackingNumber = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    CourierUserId = table.Column<int>(type: "int", nullable: true),
                    CourierName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ShippedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Shipments_ShippedAt"),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shipments", x => x.Id);
                    table.CheckConstraint("CK_Shipments_ByMethod", "([DeliveryMethod] = 'Paqueteria' AND [Carrier] IS NOT NULL AND [TrackingNumber] IS NOT NULL AND [CourierUserId] IS NULL AND [CourierName] IS NULL) OR ([DeliveryMethod] = 'Local' AND ([CourierUserId] IS NOT NULL OR [CourierName] IS NOT NULL) AND [Carrier] IS NULL AND [TrackingNumber] IS NULL)");
                    table.CheckConstraint("CK_Shipments_Carrier", "[Carrier] IS NULL OR [Carrier] IN ('Estafeta', 'DHLExpress')");
                    table.CheckConstraint("CK_Shipments_DeliveredAt", "[DeliveredAt] IS NULL OR [DeliveredAt] >= [ShippedAt]");
                    table.CheckConstraint("CK_Shipments_DeliveryMethod", "[DeliveryMethod] IN ('Local', 'Paqueteria')");
                    table.CheckConstraint("CK_Shipments_Tracking", "[TrackingNumber] IS NULL OR (LEN([TrackingNumber]) >= 10 AND [TrackingNumber] NOT LIKE '%[^0-9]%')");
                    table.ForeignKey(
                        name: "FK_Shipments_Orders",
                        column: x => x.OrderId,
                        principalSchema: "dbo",
                        principalTable: "Orders",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Shipments_Users",
                        column: x => x.CourierUserId,
                        principalSchema: "dbo",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Brands",
                columns: new[] { "Id", "CreatedAt", "IsActive", "IsOwnBrand", "Name", "ShowInFilters", "Slug" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, true, "SOKKO", true, "sokko" },
                    { 2, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Nike", true, "nike" },
                    { 3, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Puma", true, "puma" },
                    { 4, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Under Armour", true, "under-armour" },
                    { 5, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Pokémon", true, "pokemon" },
                    { 6, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Sin marca", false, "sin-marca" }
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Collections",
                columns: new[] { "Id", "CreatedAt", "EndDay", "EndMonth", "IsActive", "Kind", "Name", "OffSeasonDiscountPct", "Slug", "StartDay", "StartMonth", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), (byte)6, (byte)1, true, "Temporada", "Navidad", 0.30m, "navidad", (byte)1, (byte)11, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), (byte)2, (byte)11, true, "Temporada", "Halloween", 0.30m, "halloween", (byte)1, (byte)10, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 3, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), null, null, true, "Tematica", "Anime", 0.30m, "anime", null, null, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Colors",
                columns: new[] { "Code", "Hex", "IsActive", "IsSokkoTone", "LineHex", "Name", "Slug", "SortOrder" },
                values: new object[,]
                {
                    { "BLA", "#FFFFFF", true, false, "#23211E", "Blanco", "blanco", (byte)6 },
                    { "GRI", "#8A8A8A", true, false, "#F4F0EB", "Gris", "gris", (byte)7 },
                    { "LAC", "#9E2F2C", true, true, "#F4F0EB", "Rojo Laca", "laca", (byte)3 },
                    { "MAT", "#6E7A5E", true, true, "#F4F0EB", "Oliva Matcha", "matcha", (byte)4 },
                    { "MUL", null, true, false, null, "Multicolor", "multicolor", (byte)8 },
                    { "NEG", "#1C1C1C", true, false, "#F4F0EB", "Negro", "negro", (byte)5 },
                    { "SUM", "#2C2925", true, true, "#F4F0EB", "Tinta Sumi", "sumi", (byte)1 },
                    { "WAS", "#EFE8DC", true, true, "#23211E", "Blanco Washi", "washi", (byte)2 }
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "LocalDeliveryZones",
                columns: new[] { "Id", "CreatedAt", "IsActive", "IsConfirmed", "Label", "PostalCodeFrom", "PostalCodeTo" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, true, "Los Mochis", "81200", "81299" },
                    { 2, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Ejidos de Ahome", "81300", "81399" }
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "ProductTypes",
                columns: new[] { "Id", "Code", "IsActive", "Name", "SizeSystem", "SortOrder", "UnitLabel" },
                values: new object[,]
                {
                    { 1, "calcetas", true, "Calcetas", "Calceta", (byte)1, "Par" },
                    { 2, "gorras", true, "Gorras", "Unitalla", (byte)2, "Pieza" },
                    { 3, "gorros", true, "Gorros", "Unitalla", (byte)3, "Pieza" },
                    { 4, "guantes", true, "Guantes", "Guante", (byte)4, "Par" },
                    { 5, "bufandas", true, "Bufandas", "Unitalla", (byte)5, "Pieza" },
                    { 6, "mangas", true, "Mangas", "Unitalla", (byte)6, "Par" },
                    { 7, "lentes", true, "Lentes", "Unitalla", (byte)7, "Pieza" }
                });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Settings",
                columns: new[] { "Id", "FeaturedProductId", "FewUnitsThreshold", "FreeShippingThreshold", "IvaRate", "LocalFreeShipping", "LocalShippingCost", "ParcelShippingCost", "UpdatedAt", "UpdatedByUserId" },
                values: new object[] { (byte)1, null, 4, 799.00m, 0.1600m, true, 49.00m, 99.00m, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), null });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Sizes",
                columns: new[] { "Id", "Code", "IsActive", "Label", "SizeSystem", "SortOrder" },
                values: new object[,]
                {
                    { 1, "S", true, "22–24 cm", "Calceta", (byte)1 },
                    { 2, "M", true, "25–27 cm", "Calceta", (byte)2 },
                    { 3, "L", true, "28–30 cm", "Calceta", (byte)3 },
                    { 4, "S", true, "Chica", "Guante", (byte)1 },
                    { 5, "M", true, "Mediana", "Guante", (byte)2 },
                    { 6, "L", true, "Grande", "Guante", (byte)3 },
                    { 7, "U", true, "Unitalla", "Unitalla", (byte)1 }
                });

            migrationBuilder.CreateIndex(
                name: "UQ_Brands_Name",
                schema: "dbo",
                table: "Brands",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Brands_OwnBrand",
                schema: "dbo",
                table: "Brands",
                column: "IsOwnBrand",
                unique: true,
                filter: "[IsOwnBrand] = 1");

            migrationBuilder.CreateIndex(
                name: "UQ_Brands_Slug",
                schema: "dbo",
                table: "Brands",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Collections_Kind_Window",
                schema: "dbo",
                table: "Collections",
                columns: new[] { "Kind", "StartKey", "EndKey" },
                filter: "[IsActive] = 1")
                .Annotation("SqlServer:Include", new[] { "OffSeasonDiscountPct" });

            migrationBuilder.CreateIndex(
                name: "UQ_Collections_Name",
                schema: "dbo",
                table: "Collections",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Collections_Slug",
                schema: "dbo",
                table: "Collections",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Colors_IsSokkoTone",
                schema: "dbo",
                table: "Colors",
                column: "IsSokkoTone");

            migrationBuilder.CreateIndex(
                name: "UQ_Colors_Name",
                schema: "dbo",
                table: "Colors",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Colors_Slug",
                schema: "dbo",
                table: "Colors",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_CreatedByUserId",
                schema: "dbo",
                table: "InventoryMovements",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_OrderId",
                schema: "dbo",
                table: "InventoryMovements",
                column: "OrderId",
                filter: "[OrderId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryMovements_VariantId_CreatedAt",
                schema: "dbo",
                table: "InventoryMovements",
                columns: new[] { "VariantId", "CreatedAt" },
                descending: new[] { false, true })
                .Annotation("SqlServer:Include", new[] { "Type", "Quantity", "Balance", "CreatedByName", "Note" });

            migrationBuilder.CreateIndex(
                name: "UQ_LocalDeliveryZones_Range",
                schema: "dbo",
                table: "LocalDeliveryZones",
                columns: new[] { "PostalCodeFrom", "PostalCodeTo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_VariantId",
                schema: "dbo",
                table: "OrderItems",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "UQ_OrderItems_Order_Variant",
                schema: "dbo",
                table: "OrderItems",
                columns: new[] { "OrderId", "VariantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CreatedAt",
                schema: "dbo",
                table: "Orders",
                column: "CreatedAt")
                .Annotation("SqlServer:Include", new[] { "Status", "Total", "ShippingCost", "Subtotal" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerEmail",
                schema: "dbo",
                table: "Orders",
                column: "CustomerEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PendingPayment",
                schema: "dbo",
                table: "Orders",
                column: "CreatedAt",
                filter: "[PaymentStatus] = 'Pendiente'")
                .Annotation("SqlServer:Include", new[] { "PaymentMethod", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status_CreatedAt",
                schema: "dbo",
                table: "Orders",
                columns: new[] { "Status", "CreatedAt" })
                .Annotation("SqlServer:Include", new[] { "DeliveryMethod", "PaymentMethod", "PaymentStatus", "Total" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_UserId_CreatedAt",
                schema: "dbo",
                table: "Orders",
                columns: new[] { "UserId", "CreatedAt" },
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_Orders_Folio",
                schema: "dbo",
                table: "Orders",
                column: "Folio",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Orders_FolioNumber",
                schema: "dbo",
                table: "Orders",
                column: "FolioNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusHistory_ChangedByUserId",
                schema: "dbo",
                table: "OrderStatusHistory",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusHistory_OrderId_ChangedAt",
                schema: "dbo",
                table: "OrderStatusHistory",
                columns: new[] { "OrderId", "ChangedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_UserId_ExpiresAt",
                schema: "dbo",
                table: "PasswordResetTokens",
                columns: new[] { "UserId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "UQ_PasswordResetTokens_TokenHash",
                schema: "dbo",
                table: "PasswordResetTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_BrandId",
                schema: "dbo",
                table: "Products",
                column: "BrandId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_CollectionId",
                schema: "dbo",
                table: "Products",
                column: "CollectionId",
                filter: "[CollectionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Line_IsActive",
                schema: "dbo",
                table: "Products",
                columns: new[] { "Line", "IsActive" })
                .Annotation("SqlServer:Include", new[] { "BrandId", "ProductTypeId", "CollectionId", "Price" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_ProductTypeId",
                schema: "dbo",
                table: "Products",
                column: "ProductTypeId");

            migrationBuilder.CreateIndex(
                name: "UQ_Products_Line_PieceNumber",
                schema: "dbo",
                table: "Products",
                columns: new[] { "Line", "PieceNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Products_Slug",
                schema: "dbo",
                table: "Products",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_ProductTypes_Code",
                schema: "dbo",
                table: "ProductTypes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_ProductTypes_Name",
                schema: "dbo",
                table: "ProductTypes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ColorCode",
                schema: "dbo",
                table: "ProductVariants",
                column: "ColorCode");

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_SizeId",
                schema: "dbo",
                table: "ProductVariants",
                column: "SizeId");

            migrationBuilder.CreateIndex(
                name: "UQ_ProductVariants_Barcode",
                schema: "dbo",
                table: "ProductVariants",
                column: "Barcode",
                unique: true,
                filter: "[Barcode] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_ProductVariants_Product_Color_Size",
                schema: "dbo",
                table: "ProductVariants",
                columns: new[] { "ProductId", "ColorCode", "SizeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_ProductVariants_Sku",
                schema: "dbo",
                table: "ProductVariants",
                column: "Sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Settings_FeaturedProductId",
                schema: "dbo",
                table: "Settings",
                column: "FeaturedProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Settings_UpdatedByUserId",
                schema: "dbo",
                table: "Settings",
                column: "UpdatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_CourierUserId",
                schema: "dbo",
                table: "Shipments",
                column: "CourierUserId",
                filter: "[CourierUserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_TrackingNumber",
                schema: "dbo",
                table: "Shipments",
                column: "TrackingNumber",
                filter: "[TrackingNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UQ_Shipments_OrderId",
                schema: "dbo",
                table: "Shipments",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Sizes_System_Code",
                schema: "dbo",
                table: "Sizes",
                columns: new[] { "SizeSystem", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Sizes_System_SortOrder",
                schema: "dbo",
                table: "Sizes",
                columns: new[] { "SizeSystem", "SortOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_PreferredSizeId",
                schema: "dbo",
                table: "Users",
                column: "PreferredSizeId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Role",
                schema: "dbo",
                table: "Users",
                column: "Role",
                filter: "[Role] <> 'Customer'");

            migrationBuilder.CreateIndex(
                name: "UQ_Users_Email",
                schema: "dbo",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InventoryMovements",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "LocalDeliveryZones",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "OrderItems",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "OrderStatusHistory",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "PasswordResetTokens",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Settings",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Shipments",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ProductVariants",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Orders",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Colors",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Products",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Users",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Brands",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Collections",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ProductTypes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Sizes",
                schema: "dbo");

            migrationBuilder.DropSequence(
                name: "OrderFolioSeq",
                schema: "dbo");
        }
    }
}
