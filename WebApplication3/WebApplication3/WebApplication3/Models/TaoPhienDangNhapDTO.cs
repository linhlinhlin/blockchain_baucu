namespace WebApplication3.Models
{
    public class TaoPhienDangNhapDTO
    {
        public int TaiKhoanID { get; set; }
        public string DuLieuPhien { get; set; } = string.Empty;
        public string IP { get; set; } = string.Empty;
        public string ThietBi { get; set; } = string.Empty;
        public string TrinhDuyet { get; set; } = string.Empty;
        public DateTime NgayHetHan { get; set; }
    }

}
