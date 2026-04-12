using System;

namespace WebApplication3.Models
{
    public partial class PhienDangNhap
    {
        public int Id { get; set; }
        public int TaiKhoanId { get; set; }
        public string DuLieuPhien { get; set; } = null!;
        public string? IP { get; set; }
        public string? ThietBi { get; set; }
        public string? TrinhDuyet { get; set; }
        public DateTime NgayTao { get; set; } = DateTime.Now;
        public DateTime NgayHetHan { get; set; }
        public bool IsActive { get; set; } = true;

        public virtual TaiKhoan TaiKhoan { get; set; } = null!;
    }
}

