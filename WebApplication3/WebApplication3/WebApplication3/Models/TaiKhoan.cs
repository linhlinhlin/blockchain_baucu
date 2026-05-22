using System.ComponentModel.DataAnnotations;
using WebApplication3.Models;

public partial class TaiKhoan
{
    [Key]
    public int Id { get; set; }

    public string TenDangNhap { get; set; } = null!;
    public string MatKhau { get; set; } = null!;
    public string Email { get; set; } = null!;
    public bool TrangThai { get; set; }
    public DateOnly? LanDangNhapCuoi { get; set; }
    public DateOnly? NgayThamGia { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    // Thêm hai cột mới
    public string? TenHienThi { get; set; } // Cho phép null
    public bool IsMetaMask { get; set; }


    public virtual ICollection<PhienDangNhap> PhienDangNhaps { get; set; } = new List<PhienDangNhap>();
    public virtual ICollection<CuocBauCu> CuocBauCus { get; set; } = new List<CuocBauCu>();
    public virtual ICollection<PhieuMoiPhienBauCu> PhieuMoiPhienBauCus { get; set; } = new List<PhieuMoiPhienBauCu>();
    public virtual ICollection<UploadFile> UploadFiles { get; set; } = new List<UploadFile>();
}
