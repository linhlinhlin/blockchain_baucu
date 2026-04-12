using System;

namespace WebApplication3.Models
{
    public class KhoaPhienDTO
    {
        public int MaKhoaID { get; set; }
        public int TaiKhoanID { get; set; }
        public int ViID { get; set; }
        public string? Khoa { get; set; }
        public DateTime ThoiHan { get; set; }
        public long ThoiHanUnix { get; set; } // Thêm trường mới
        public virtual TaiKhoan? TaiKhoan { get; set; }
        public virtual ViBlockchain? ViBlockchain { get; set; }
    }
}