using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Sokko.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AlignCatalogWithStore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Brands",
                columns: new[] { "Id", "CreatedAt", "IsActive", "IsOwnBrand", "Name", "ShowInFilters", "Slug" },
                values: new object[] { 7, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), true, false, "Marvel", true, "marvel" });

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Collections",
                columns: new[] { "Id", "CreatedAt", "EndDay", "EndMonth", "IsActive", "Kind", "Name", "OffSeasonDiscountPct", "Slug", "StartDay", "StartMonth", "UpdatedAt" },
                values: new object[] { 4, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc), null, null, true, "Tematica", "Superhéroes", 0.30m, "superheroes", null, null, new DateTime(2026, 10, 21, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "BLA",
                column: "Hex",
                value: "#F7F5F1");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "GRI",
                columns: new[] { "Hex", "LineHex", "Name" },
                values: new object[] { "#A7A39C", "#23211E", "Gris jaspe" });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "MUL",
                columns: new[] { "Hex", "LineHex" },
                values: new object[] { "#7A5C8E", "#F4F0EB" });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "NEG",
                column: "Hex",
                value: "#1F1D1B");

            migrationBuilder.InsertData(
                schema: "dbo",
                table: "Colors",
                columns: new[] { "Code", "Hex", "IsActive", "IsSokkoTone", "LineHex", "Name", "Slug", "SortOrder" },
                values: new object[,]
                {
                    { "AMA", "#E3B53B", true, false, "#23211E", "Amarillo", "amarillo", (byte)13 },
                    { "AZU", "#26385C", true, false, "#F4F0EB", "Azul noche", "azul", (byte)12 },
                    { "CAM", "#B08A63", true, false, "#23211E", "Camello", "camello", (byte)14 },
                    { "NAR", "#D06A26", true, false, "#F4F0EB", "Calabaza", "calabaza", (byte)11 },
                    { "ROJ", "#B5302B", true, false, "#F4F0EB", "Rojo", "rojo", (byte)9 },
                    { "VER", "#2F5A43", true, false, "#F4F0EB", "Verde pino", "verde", (byte)10 }
                });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Label",
                value: "Palma 17–19 cm");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 5,
                column: "Label",
                value: "Palma 19–21 cm");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 6,
                column: "Label",
                value: "Palma 21–23 cm");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 7,
                column: "Label",
                value: "Talla única");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Brands",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Collections",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "AMA");

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "AZU");

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "CAM");

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "NAR");

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "ROJ");

            migrationBuilder.DeleteData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "VER");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "BLA",
                column: "Hex",
                value: "#FFFFFF");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "GRI",
                columns: new[] { "Hex", "LineHex", "Name" },
                values: new object[] { "#8A8A8A", "#F4F0EB", "Gris" });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "MUL",
                columns: new[] { "Hex", "LineHex" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Colors",
                keyColumn: "Code",
                keyValue: "NEG",
                column: "Hex",
                value: "#1C1C1C");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Label",
                value: "Chica");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 5,
                column: "Label",
                value: "Mediana");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 6,
                column: "Label",
                value: "Grande");

            migrationBuilder.UpdateData(
                schema: "dbo",
                table: "Sizes",
                keyColumn: "Id",
                keyValue: 7,
                column: "Label",
                value: "Unitalla");
        }
    }
}
