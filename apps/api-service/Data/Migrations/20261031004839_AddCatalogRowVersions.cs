using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogRowVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                schema: "dbo",
                table: "ProductTypes",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                schema: "dbo",
                table: "Products",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                schema: "dbo",
                table: "Collections",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                schema: "dbo",
                table: "Brands",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RowVersion",
                schema: "dbo",
                table: "ProductTypes");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                schema: "dbo",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                schema: "dbo",
                table: "Collections");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                schema: "dbo",
                table: "Brands");
        }
    }
}
