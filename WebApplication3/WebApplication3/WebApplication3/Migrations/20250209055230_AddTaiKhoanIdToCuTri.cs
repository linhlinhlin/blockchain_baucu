using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication3.Migrations
{
    /// <inheritdoc />
    public partial class AddTaiKhoanIdToCuTri : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TaiKhoanId",
                table: "CuTri",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TaiKhoanId",
                table: "CuocBauCu",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuTri_TaiKhoanId",
                table: "CuTri",
                column: "TaiKhoanId");

            migrationBuilder.CreateIndex(
                name: "IX_CuocBauCu_TaiKhoanId",
                table: "CuocBauCu",
                column: "TaiKhoanId");

            migrationBuilder.AddForeignKey(
                name: "FK_CuocBauCu_TaiKhoan",
                table: "CuocBauCu",
                column: "TaiKhoanId",
                principalTable: "TaiKhoan",
                principalColumn: "ID");

            migrationBuilder.AddForeignKey(
                name: "FK_CuTri_TaiKhoan_TaiKhoanId",
                table: "CuTri",
                column: "TaiKhoanId",
                principalTable: "TaiKhoan",
                principalColumn: "ID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CuocBauCu_TaiKhoan",
                table: "CuocBauCu");

            migrationBuilder.DropForeignKey(
                name: "FK_CuTri_TaiKhoan_TaiKhoanId",
                table: "CuTri");

            migrationBuilder.DropIndex(
                name: "IX_CuTri_TaiKhoanId",
                table: "CuTri");

            migrationBuilder.DropIndex(
                name: "IX_CuocBauCu_TaiKhoanId",
                table: "CuocBauCu");

            migrationBuilder.DropColumn(
                name: "TaiKhoanId",
                table: "CuTri");

            migrationBuilder.DropColumn(
                name: "TaiKhoanId",
                table: "CuocBauCu");
        }
    }
}
