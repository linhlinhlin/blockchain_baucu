using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication3.Migrations
{
    /// <inheritdoc />
    public partial class AddIsMetaMaskAndTenHienThiToTaiKhoan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UploadFiles_CuocBauCu_CuocBauCuUploadId",
                table: "UploadFiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UploadFiles_PhienBauCu_PhienBauCuUploadId",
                table: "UploadFiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UploadFiles_TaiKhoan_TaiKhoanUploadId",
                table: "UploadFiles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UploadFiles",
                table: "UploadFiles");

            migrationBuilder.RenameTable(
                name: "UploadFiles",
                newName: "UploadFile");

            migrationBuilder.RenameIndex(
                name: "IX_UploadFiles_TaiKhoanUploadId",
                table: "UploadFile",
                newName: "IX_UploadFile_TaiKhoanUploadId");

            migrationBuilder.RenameIndex(
                name: "IX_UploadFiles_PhienBauCuUploadId",
                table: "UploadFile",
                newName: "IX_UploadFile_PhienBauCuUploadId");

            migrationBuilder.RenameIndex(
                name: "IX_UploadFiles_CuocBauCuUploadId",
                table: "UploadFile",
                newName: "IX_UploadFile_CuocBauCuUploadId");

            migrationBuilder.AddColumn<bool>(
                name: "IsMetaMask",
                table: "TaiKhoan",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TenHienThi",
                table: "TaiKhoan",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CuocBauCuId",
                table: "PhieuMoiPhienBauCu",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<DateTime>(
                name: "NgayUpload",
                table: "UploadFile",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "datetimeoffset");

            migrationBuilder.AddColumn<string>(
                name: "KichThuocHienThi",
                table: "UploadFile",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NgayHienThi",
                table: "UploadFile",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UploadFile",
                table: "UploadFile",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "PhienDangNhap",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaiKhoanID = table.Column<int>(type: "int", nullable: false),
                    DuLieuPhien = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ThietBi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TrinhDuyet = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NgayTao = table.Column<DateTime>(type: "datetime", nullable: false),
                    NgayHetHan = table.Column<DateTime>(type: "datetime", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__PhienDan__3214EC27A7AA192E", x => x.ID);
                    table.ForeignKey(
                        name: "FK__PhienDangNhap__TaiKhoan",
                        column: x => x.TaiKhoanID,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "RevokedToken",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Token = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__RevokedToken__3214EC27A7AA192E", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "ViMetaMask",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaiKhoanId = table.Column<int>(type: "int", nullable: false),
                    DiaChiVi = table.Column<string>(type: "nvarchar(42)", maxLength: 42, nullable: false),
                    ThoiGianTao = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__ViMetaMask__3214EC27", x => x.Id);
                    table.ForeignKey(
                        name: "FK__ViMetaMask__TaiKhoanId",
                        column: x => x.TaiKhoanId,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PhieuMoiPhienBauCu_CuocBauCuId",
                table: "PhieuMoiPhienBauCu",
                column: "CuocBauCuId");

            migrationBuilder.CreateIndex(
                name: "IX_PhienDangNhap_TaiKhoanID",
                table: "PhienDangNhap",
                column: "TaiKhoanID");

            migrationBuilder.CreateIndex(
                name: "IX_ViMetaMask_DiaChiVi",
                table: "ViMetaMask",
                column: "DiaChiVi",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ViMetaMask_TaiKhoanId",
                table: "ViMetaMask",
                column: "TaiKhoanId");

            migrationBuilder.AddForeignKey(
                name: "FK__PhieuMoiPhienBauCu__CuocBauCuID",
                table: "PhieuMoiPhienBauCu",
                column: "CuocBauCuId",
                principalTable: "CuocBauCu",
                principalColumn: "ID");

            migrationBuilder.AddForeignKey(
                name: "FK_UploadFile_CuocBauCu_CuocBauCuUploadId",
                table: "UploadFile",
                column: "CuocBauCuUploadId",
                principalTable: "CuocBauCu",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UploadFile_PhienBauCu_PhienBauCuUploadId",
                table: "UploadFile",
                column: "PhienBauCuUploadId",
                principalTable: "PhienBauCu",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UploadFile_TaiKhoan_TaiKhoanUploadId",
                table: "UploadFile",
                column: "TaiKhoanUploadId",
                principalTable: "TaiKhoan",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK__PhieuMoiPhienBauCu__CuocBauCuID",
                table: "PhieuMoiPhienBauCu");

            migrationBuilder.DropForeignKey(
                name: "FK_UploadFile_CuocBauCu_CuocBauCuUploadId",
                table: "UploadFile");

            migrationBuilder.DropForeignKey(
                name: "FK_UploadFile_PhienBauCu_PhienBauCuUploadId",
                table: "UploadFile");

            migrationBuilder.DropForeignKey(
                name: "FK_UploadFile_TaiKhoan_TaiKhoanUploadId",
                table: "UploadFile");

            migrationBuilder.DropTable(
                name: "PhienDangNhap");

            migrationBuilder.DropTable(
                name: "RevokedToken");

            migrationBuilder.DropTable(
                name: "ViMetaMask");

            migrationBuilder.DropIndex(
                name: "IX_PhieuMoiPhienBauCu_CuocBauCuId",
                table: "PhieuMoiPhienBauCu");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UploadFile",
                table: "UploadFile");

            migrationBuilder.DropColumn(
                name: "IsMetaMask",
                table: "TaiKhoan");

            migrationBuilder.DropColumn(
                name: "TenHienThi",
                table: "TaiKhoan");

            migrationBuilder.DropColumn(
                name: "CuocBauCuId",
                table: "PhieuMoiPhienBauCu");

            migrationBuilder.DropColumn(
                name: "KichThuocHienThi",
                table: "UploadFile");

            migrationBuilder.DropColumn(
                name: "NgayHienThi",
                table: "UploadFile");

            migrationBuilder.RenameTable(
                name: "UploadFile",
                newName: "UploadFiles");

            migrationBuilder.RenameIndex(
                name: "IX_UploadFile_TaiKhoanUploadId",
                table: "UploadFiles",
                newName: "IX_UploadFiles_TaiKhoanUploadId");

            migrationBuilder.RenameIndex(
                name: "IX_UploadFile_PhienBauCuUploadId",
                table: "UploadFiles",
                newName: "IX_UploadFiles_PhienBauCuUploadId");

            migrationBuilder.RenameIndex(
                name: "IX_UploadFile_CuocBauCuUploadId",
                table: "UploadFiles",
                newName: "IX_UploadFiles_CuocBauCuUploadId");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "NgayUpload",
                table: "UploadFiles",
                type: "datetimeoffset",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UploadFiles",
                table: "UploadFiles",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UploadFiles_CuocBauCu_CuocBauCuUploadId",
                table: "UploadFiles",
                column: "CuocBauCuUploadId",
                principalTable: "CuocBauCu",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UploadFiles_PhienBauCu_PhienBauCuUploadId",
                table: "UploadFiles",
                column: "PhienBauCuUploadId",
                principalTable: "PhienBauCu",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UploadFiles_TaiKhoan_TaiKhoanUploadId",
                table: "UploadFiles",
                column: "TaiKhoanUploadId",
                principalTable: "TaiKhoan",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
