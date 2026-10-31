using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "IdempotencyHash",
                schema: "dbo",
                table: "Orders",
                type: "binary(32)",
                fixedLength: true,
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                schema: "dbo",
                table: "Orders",
                type: "varchar(64)",
                unicode: false,
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "UQ_Orders_IdempotencyKey",
                schema: "dbo",
                table: "Orders",
                column: "IdempotencyKey",
                unique: true,
                filter: "[IdempotencyKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UQ_Orders_IdempotencyKey",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IdempotencyHash",
                schema: "dbo",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                schema: "dbo",
                table: "Orders");
        }
    }
}
