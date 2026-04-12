using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication3.Migrations
{
    /// <inheritdoc />
    public partial class FixCauHinhHeThong : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PhieuMoiPhienBauCu",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Token = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PhienBauCuId = table.Column<int>(type: "int", nullable: false),
                    NguoiTaoId = table.Column<int>(type: "int", nullable: false),
                    NgayTao = table.Column<DateTime>(type: "date", nullable: false),
                    NgayHetHan = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HieuLuc = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__PhieuMoiPhienBauCu__3214EC27", x => x.ID);
                    table.ForeignKey(
                        name: "FK__PhieuMoiPhienBauCu__NguoiTaoID",
                        column: x => x.NguoiTaoId,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__PhieuMoiPhienBauCu__PhienBauCuID",
                        column: x => x.PhienBauCuId,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "UploadFiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileURL = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TenFileDuocTao = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TenFileGoc = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NoiDungType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    KichThuoc = table.Column<long>(type: "bigint", nullable: false),
                    NgayUpload = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    TaiKhoanUploadId = table.Column<int>(type: "int", nullable: false),
                    PhienBauCuUploadId = table.Column<int>(type: "int", nullable: false),
                    CuocBauCuUploadId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UploadFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UploadFiles_CuocBauCu_CuocBauCuUploadId",
                        column: x => x.CuocBauCuUploadId,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UploadFiles_PhienBauCu_PhienBauCuUploadId",
                        column: x => x.PhienBauCuUploadId,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UploadFiles_TaiKhoan_TaiKhoanUploadId",
                        column: x => x.TaiKhoanUploadId,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhieuMoiPhienBauCu_NguoiTaoId",
                table: "PhieuMoiPhienBauCu",
                column: "NguoiTaoId");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuMoiPhienBauCu_PhienBauCuId",
                table: "PhieuMoiPhienBauCu",
                column: "PhienBauCuId");

            migrationBuilder.CreateIndex(
                name: "IX_UploadFiles_CuocBauCuUploadId",
                table: "UploadFiles",
                column: "CuocBauCuUploadId");

            migrationBuilder.CreateIndex(
                name: "IX_UploadFiles_PhienBauCuUploadId",
                table: "UploadFiles",
                column: "PhienBauCuUploadId");

            migrationBuilder.CreateIndex(
                name: "IX_UploadFiles_TaiKhoanUploadId",
                table: "UploadFiles",
                column: "TaiKhoanUploadId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhieuMoiPhienBauCu");

            migrationBuilder.DropTable(
                name: "UploadFiles");
        }
    }
}
