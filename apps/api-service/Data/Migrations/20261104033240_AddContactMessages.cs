using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddContactMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                schema: "dbo",
                table: "Settings",
                type: "nvarchar(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ContactMessages",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    IpAddress = table.Column<string>(type: "varchar(45)", unicode: false, maxLength: 45, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ContactMessages_CreatedAt"),
                    NotifiedAt = table.Column<DateTime>(type: "datetime2(3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContactMessages", x => x.Id);
                    table.CheckConstraint("CK_ContactMessages_Message", "LEN([Message]) > 0");
                });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Settings",
                keyColumn: "Id",
                keyValue: (byte)1,
                column: "ContactEmail",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_ContactMessages_CreatedAt",
                schema: "dbo",
                table: "ContactMessages",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContactMessages",
                schema: "dbo");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                schema: "dbo",
                table: "Settings");
        }
    }
}
