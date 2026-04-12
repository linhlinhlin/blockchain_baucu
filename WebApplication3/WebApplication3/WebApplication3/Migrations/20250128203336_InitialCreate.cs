using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication3.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CauHinhHeThong",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenCauHinh = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    GiaTri = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__CauHinhH__3214EC2794D0BC2A", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "ChucNang",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenChucNang = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__ChucNang__3214EC27E7B6E84B", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CuocBauCu",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenCuocBauCu = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MoTa = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NgayBatDau = table.Column<DateTime>(type: "datetime", nullable: false),
                    NgayKetThuc = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__CuocBauC__3214EC27927CACAC", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "TaiKhoan",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenDangNhap = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    MatKhau = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TrangThai = table.Column<bool>(type: "bit", nullable: false),
                    LanDangNhapCuoi = table.Column<DateOnly>(type: "date", nullable: true),
                    NgayThamGia = table.Column<DateOnly>(type: "date", nullable: true),
                    RefreshToken = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RefreshTokenExpiryTime = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__TaiKhoan__3214EC27D89FB40D", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "VaiTro",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenVaiTro = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__VaiTro__3214EC27D51DCEC4", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "PhienBauCu",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenPhienBauCu = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CuocBauCuID = table.Column<int>(type: "int", nullable: false),
                    MoTa = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NgayBatDau = table.Column<DateTime>(type: "datetime", nullable: false),
                    NgayKetThuc = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__PhienBau__3214EC279845F2B0", x => x.ID);
                    table.ForeignKey(
                        name: "FK__PhienBauC__CuocB__398D8EEE",
                        column: x => x.CuocBauCuID,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "LichSuHoatDong",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaiKhoanID = table.Column<int>(type: "int", nullable: false),
                    HoatDong = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ThoiGian = table.Column<DateTime>(type: "datetime", nullable: false),
                    MoTa = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__LichSuHo__3214EC27BB880488", x => x.ID);
                    table.ForeignKey(
                        name: "FK_LichSuHoatDong_TaiKhoan_TaiKhoanID",
                        column: x => x.TaiKhoanID,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ThongBao",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaiKhoanID = table.Column<int>(type: "int", nullable: false),
                    TieuDe = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    NoiDung = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NgayGui = table.Column<DateTime>(type: "datetime", nullable: false),
                    TrangThai = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__ThongBao__3214EC277ABA96BB", x => x.ID);
                    table.ForeignKey(
                        name: "FK_ThongBao_TaiKhoan_TaiKhoanID",
                        column: x => x.TaiKhoanID,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaiKhoanVaiTroAdmin",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaiKhoanID = table.Column<int>(type: "int", nullable: false),
                    VaiTroID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__TaiKhoan__3214EC278D24B91C", x => x.ID);
                    table.ForeignKey(
                        name: "FK_TaiKhoanVaiTroAdmin_TaiKhoan_TaiKhoanID",
                        column: x => x.TaiKhoanID,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK__TaiKhoanV__VaiTr__68487DD7",
                        column: x => x.VaiTroID,
                        principalTable: "VaiTro",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "VaiTroChucNang",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VaiTroID = table.Column<int>(type: "int", nullable: false),
                    ChucNangID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__VaiTroCh__3214EC2722F02E55", x => x.ID);
                    table.ForeignKey(
                        name: "FK__VaiTroChu__ChucN__5EBF139D",
                        column: x => x.ChucNangID,
                        principalTable: "ChucNang",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__VaiTroChu__VaiTr__5DCAEF64",
                        column: x => x.VaiTroID,
                        principalTable: "VaiTro",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "CuTri",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SDT = table.Column<string>(type: "varchar(11)", unicode: false, maxLength: 11, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    XacMinh = table.Column<bool>(type: "bit", nullable: false),
                    BoPhieu = table.Column<bool>(type: "bit", nullable: false),
                    SoLanGuiOTP = table.Column<int>(type: "int", nullable: false),
                    CuocBauCuID = table.Column<int>(type: "int", nullable: false),
                    PhienBauCuID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__CuTri__3214EC27CBD841C7", x => x.ID);
                    table.ForeignKey(
                        name: "FK__CuTri__CuocBauCu__48CFD27E",
                        column: x => x.CuocBauCuID,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__CuTri__PhienBauC__49C3F6B7",
                        column: x => x.PhienBauCuID,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "TaiKhoanVaiTroUser",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TaiKhoanID = table.Column<int>(type: "int", nullable: false),
                    VaiTroID = table.Column<int>(type: "int", nullable: false),
                    CuocBauCuID = table.Column<int>(type: "int", nullable: true),
                    PhienBauCuID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__TaiKhoan__3214EC2711CBAC23", x => x.ID);
                    table.ForeignKey(
                        name: "FK_TaiKhoanVaiTroUser_TaiKhoan_TaiKhoanID",
                        column: x => x.TaiKhoanID,
                        principalTable: "TaiKhoan",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK__TaiKhoanV__CuocB__6383C8BA",
                        column: x => x.CuocBauCuID,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__TaiKhoanV__Phien__6477ECF3",
                        column: x => x.PhienBauCuID,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__TaiKhoanV__VaiTr__628FA481",
                        column: x => x.VaiTroID,
                        principalTable: "VaiTro",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "ViTriUngCu",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenViTriUngCu = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SoPhieuToiDa = table.Column<int>(type: "int", nullable: false),
                    PhienBauCuID = table.Column<int>(type: "int", nullable: true),
                    CuocBauCuID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__ViTriUng__3214EC273EF067E8", x => x.ID);
                    table.ForeignKey(
                        name: "FK__ViTriUngC__CuocB__3F466844",
                        column: x => x.CuocBauCuID,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__ViTriUngC__Phien__3E52440B",
                        column: x => x.PhienBauCuID,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "UngCuVien",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    HoTen = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Anh = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MoTa = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ViTriUngCuID = table.Column<int>(type: "int", nullable: false),
                    CuocBauCuID = table.Column<int>(type: "int", nullable: false),
                    PhienBauCuID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__UngCuVie__3214EC27864EE498", x => x.ID);
                    table.ForeignKey(
                        name: "FK__UngCuVien__CuocB__4316F928",
                        column: x => x.CuocBauCuID,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__UngCuVien__Phien__440B1D61",
                        column: x => x.PhienBauCuID,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__UngCuVien__ViTri__4222D4EF",
                        column: x => x.ViTriUngCuID,
                        principalTable: "ViTriUngCu",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateTable(
                name: "PhieuBau",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UngCuVienID = table.Column<int>(type: "int", nullable: false),
                    CuTriID = table.Column<int>(type: "int", nullable: false),
                    ViTriUngCuID = table.Column<int>(type: "int", nullable: false),
                    PhienBauCuID = table.Column<int>(type: "int", nullable: true),
                    CuocBauCuID = table.Column<int>(type: "int", nullable: false),
                    TrangThai = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK__PhieuBau__3214EC27BE61F897", x => x.ID);
                    table.ForeignKey(
                        name: "FK__PhieuBau__CuTriI__4D94879B",
                        column: x => x.CuTriID,
                        principalTable: "CuTri",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__PhieuBau__CuocBa__5070F446",
                        column: x => x.CuocBauCuID,
                        principalTable: "CuocBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__PhieuBau__PhienB__4F7CD00D",
                        column: x => x.PhienBauCuID,
                        principalTable: "PhienBauCu",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__PhieuBau__UngCuV__4CA06362",
                        column: x => x.UngCuVienID,
                        principalTable: "UngCuVien",
                        principalColumn: "ID");
                    table.ForeignKey(
                        name: "FK__PhieuBau__ViTriU__4E88ABD4",
                        column: x => x.ViTriUngCuID,
                        principalTable: "ViTriUngCu",
                        principalColumn: "ID");
                });

            migrationBuilder.CreateIndex(
                name: "UQ__ChucNang__CFD37AFA69DDD913",
                table: "ChucNang",
                column: "TenChucNang",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CuTri_CuocBauCuID",
                table: "CuTri",
                column: "CuocBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_CuTri_PhienBauCuID",
                table: "CuTri",
                column: "PhienBauCuID");

            migrationBuilder.CreateIndex(
                name: "UQ__CuTri__A9D10534D6D5F218",
                table: "CuTri",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UQ__CuTri__CA1930A5375CB211",
                table: "CuTri",
                column: "SDT",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LichSuHoatDong_TaiKhoanID",
                table: "LichSuHoatDong",
                column: "TaiKhoanID");

            migrationBuilder.CreateIndex(
                name: "IX_PhienBauCu_CuocBauCuID",
                table: "PhienBauCu",
                column: "CuocBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuBau_CuocBauCuID",
                table: "PhieuBau",
                column: "CuocBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuBau_CuTriID",
                table: "PhieuBau",
                column: "CuTriID");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuBau_PhienBauCuID",
                table: "PhieuBau",
                column: "PhienBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuBau_UngCuVienID",
                table: "PhieuBau",
                column: "UngCuVienID");

            migrationBuilder.CreateIndex(
                name: "IX_PhieuBau_ViTriUngCuID",
                table: "PhieuBau",
                column: "ViTriUngCuID");

            migrationBuilder.CreateIndex(
                name: "UQ__TaiKhoan__55F68FC0C79307E2",
                table: "TaiKhoan",
                column: "TenDangNhap",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaiKhoanVaiTroAdmin_TaiKhoanID",
                table: "TaiKhoanVaiTroAdmin",
                column: "TaiKhoanID");

            migrationBuilder.CreateIndex(
                name: "IX_TaiKhoanVaiTroAdmin_VaiTroID",
                table: "TaiKhoanVaiTroAdmin",
                column: "VaiTroID");

            migrationBuilder.CreateIndex(
                name: "IX_TaiKhoanVaiTroUser_CuocBauCuID",
                table: "TaiKhoanVaiTroUser",
                column: "CuocBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_TaiKhoanVaiTroUser_PhienBauCuID",
                table: "TaiKhoanVaiTroUser",
                column: "PhienBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_TaiKhoanVaiTroUser_TaiKhoanID",
                table: "TaiKhoanVaiTroUser",
                column: "TaiKhoanID");

            migrationBuilder.CreateIndex(
                name: "IX_TaiKhoanVaiTroUser_VaiTroID",
                table: "TaiKhoanVaiTroUser",
                column: "VaiTroID");

            migrationBuilder.CreateIndex(
                name: "IX_ThongBao_TaiKhoanID",
                table: "ThongBao",
                column: "TaiKhoanID");

            migrationBuilder.CreateIndex(
                name: "IX_UngCuVien_CuocBauCuID",
                table: "UngCuVien",
                column: "CuocBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_UngCuVien_PhienBauCuID",
                table: "UngCuVien",
                column: "PhienBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_UngCuVien_ViTriUngCuID",
                table: "UngCuVien",
                column: "ViTriUngCuID");

            migrationBuilder.CreateIndex(
                name: "UQ__VaiTro__1DA5581450B576A1",
                table: "VaiTro",
                column: "TenVaiTro",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VaiTroChucNang_ChucNangID",
                table: "VaiTroChucNang",
                column: "ChucNangID");

            migrationBuilder.CreateIndex(
                name: "IX_VaiTroChucNang_VaiTroID",
                table: "VaiTroChucNang",
                column: "VaiTroID");

            migrationBuilder.CreateIndex(
                name: "IX_ViTriUngCu_CuocBauCuID",
                table: "ViTriUngCu",
                column: "CuocBauCuID");

            migrationBuilder.CreateIndex(
                name: "IX_ViTriUngCu_PhienBauCuID",
                table: "ViTriUngCu",
                column: "PhienBauCuID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CauHinhHeThong");

            migrationBuilder.DropTable(
                name: "LichSuHoatDong");

            migrationBuilder.DropTable(
                name: "PhieuBau");

            migrationBuilder.DropTable(
                name: "TaiKhoanVaiTroAdmin");

            migrationBuilder.DropTable(
                name: "TaiKhoanVaiTroUser");

            migrationBuilder.DropTable(
                name: "ThongBao");

            migrationBuilder.DropTable(
                name: "VaiTroChucNang");

            migrationBuilder.DropTable(
                name: "CuTri");

            migrationBuilder.DropTable(
                name: "UngCuVien");

            migrationBuilder.DropTable(
                name: "TaiKhoan");

            migrationBuilder.DropTable(
                name: "ChucNang");

            migrationBuilder.DropTable(
                name: "VaiTro");

            migrationBuilder.DropTable(
                name: "ViTriUngCu");

            migrationBuilder.DropTable(
                name: "PhienBauCu");

            migrationBuilder.DropTable(
                name: "CuocBauCu");
        }
    }
}
