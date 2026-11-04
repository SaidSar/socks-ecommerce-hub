using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCoupons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Total",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.AddColumn<string>(
                name: "CouponCode",
                schema: "dbo",
                table: "Orders",
                type: "varchar(30)",
                unicode: false,
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountAmount",
                schema: "dbo",
                table: "Orders",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m)
                .Annotation("Relational:DefaultConstraintName", "DF_Orders_DiscountAmount");

            migrationBuilder.CreateTable(
                name: "Coupons",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Type = table.Column<string>(type: "varchar(12)", unicode: false, maxLength: 12, nullable: false),
                    Value = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    MinSubtotal = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    MaxRedemptions = table.Column<int>(type: "int", nullable: true),
                    OnePerCustomer = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                        .Annotation("Relational:DefaultConstraintName", "DF_Coupons_OnePerCustomer"),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Coupons_IsActive"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Coupons_CreatedAt"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Coupons_UpdatedAt"),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Coupons", x => x.Id);
                    table.CheckConstraint("CK_Coupons_Code", "LEN([Code]) BETWEEN 3 AND 30 AND [Code] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z0-9-]%'");
                    table.CheckConstraint("CK_Coupons_Dates", "[StartsOn] IS NULL OR [EndsOn] IS NULL OR [EndsOn] >= [StartsOn]");
                    table.CheckConstraint("CK_Coupons_MaxRedemptions", "[MaxRedemptions] IS NULL OR [MaxRedemptions] >= 1");
                    table.CheckConstraint("CK_Coupons_MinSubtotal", "[MinSubtotal] IS NULL OR [MinSubtotal] > 0");
                    table.CheckConstraint("CK_Coupons_Type", "[Type] IN ('Percent', 'Fixed', 'FreeShipping')");
                    table.CheckConstraint("CK_Coupons_Value", "([Type] = 'Percent' AND [Value] BETWEEN 1 AND 90) OR ([Type] = 'Fixed' AND [Value] > 0) OR ([Type] = 'FreeShipping' AND [Value] = 0)");
                });

            migrationBuilder.CreateTable(
                name: "CouponRedemptions",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CouponId = table.Column<int>(type: "int", nullable: false),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    CustomerEmail = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_CouponRedemptions_CreatedAt")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CouponRedemptions", x => x.Id);
                    table.CheckConstraint("CK_CouponRedemptions_DiscountAmount", "[DiscountAmount] >= 0");
                    table.ForeignKey(
                        name: "FK_CouponRedemptions_Coupons",
                        column: x => x.CouponId,
                        principalSchema: "dbo",
                        principalTable: "Coupons",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CouponRedemptions_Orders",
                        column: x => x.OrderId,
                        principalSchema: "dbo",
                        principalTable: "Orders",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CouponCode",
                schema: "dbo",
                table: "Orders",
                column: "CouponCode",
                filter: "[CouponCode] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_DiscountAmount",
                schema: "dbo",
                table: "Orders",
                sql: "[DiscountAmount] >= 0 AND [DiscountAmount] <= [Subtotal]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Total",
                schema: "dbo",
                table: "Orders",
                sql: "[Total] = [Subtotal] - [DiscountAmount] + [ShippingCost]");

            migrationBuilder.CreateIndex(
                name: "IX_CouponRedemptions_CouponId_CustomerEmail",
                schema: "dbo",
                table: "CouponRedemptions",
                columns: new[] { "CouponId", "CustomerEmail" });

            migrationBuilder.CreateIndex(
                name: "UQ_CouponRedemptions_OrderId",
                schema: "dbo",
                table: "CouponRedemptions",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Coupons_Code",
                schema: "dbo",
                table: "Coupons",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CouponRedemptions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Coupons",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_Orders_CouponCode",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_DiscountAmount",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Total",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CouponCode",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DiscountAmount",
                schema: "dbo",
                table: "Orders")
                .Annotation("Relational:DefaultConstraintName", "DF_Orders_DiscountAmount");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Total",
                schema: "dbo",
                table: "Orders",
                sql: "[Total] = [Subtotal] + [ShippingCost]");
        }
    }
}
