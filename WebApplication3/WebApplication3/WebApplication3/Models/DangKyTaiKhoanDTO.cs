using System;

namespace WebApplication3.Models
{
    public class DangKyTaiKhoanDTO
    {
        public int Id { get; set; }
        public string TenDangNhap { get; set; }
        public string MatKhau { get; set; }
        public string Email { get; set; }
        public string? Ho { get; set; }
        public string? Ten { get; set; }
        public string? Sdt { get; set; }
        public DateOnly? NgaySinh { get; set; }
        public bool? GioiTinh { get; set; }
        public bool TrangThai { get; set; }
        public DateOnly NgayThamGia { get; set; }
        public DateOnly LanDangNhapCuoi { get; set; }
        public string? RecaptchaToken { get; set; }
    }
}
