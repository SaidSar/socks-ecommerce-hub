using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddContactMessageStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ContactMessages_CreatedAt",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAt",
                schema: "dbo",
                table: "ContactMessages",
                type: "datetime2(3)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandledByUserId",
                schema: "dbo",
                table: "ContactMessages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReadAt",
                schema: "dbo",
                table: "ContactMessages",
                type: "datetime2(3)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContactMessages_CreatedAt",
                schema: "dbo",
                table: "ContactMessages",
                column: "CreatedAt",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "IX_ContactMessages_HandledByUserId",
                schema: "dbo",
                table: "ContactMessages",
                column: "HandledByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ContactMessages_Users",
                schema: "dbo",
                table: "ContactMessages",
                column: "HandledByUserId",
                principalSchema: "dbo",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContactMessages_Users",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.DropIndex(
                name: "IX_ContactMessages_CreatedAt",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.DropIndex(
                name: "IX_ContactMessages_HandledByUserId",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.DropColumn(
                name: "HandledByUserId",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.DropColumn(
                name: "ReadAt",
                schema: "dbo",
                table: "ContactMessages");

            migrationBuilder.CreateIndex(
                name: "IX_ContactMessages_CreatedAt",
                schema: "dbo",
                table: "ContactMessages",
                column: "CreatedAt");
        }
    }
}
