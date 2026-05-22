using System;

namespace WebApplication3.Models
{
    public class TaiKhoanDTO
    {
        public int Id { get; set; }
        public string TenDangNhap { get; set; } = null!;
        public string? HoTen { get; set; } // Có thể bỏ nếu không dùng
        public string Email { get; set; } = null!;
        public bool TrangThai { get; set; }
        public DateOnly NgayThamGia { get; set; }
        public DateOnly? LanDangNhapCuoi { get; set; }
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiryTime { get; set; }
        public VaiTroDTO VaiTro { get; set; } = null!;
        public virtual ICollection<CuocBauCu> CuocBauCus { get; set; } = new List<CuocBauCu>();

        // Thêm các trường mới
        public bool IsMetaMask { get; set; }
        public string? TenHienThi { get; set; }
        public string? DiaChiVi { get; set; } // Địa chỉ ví từ ViMetaMask
    }
}
