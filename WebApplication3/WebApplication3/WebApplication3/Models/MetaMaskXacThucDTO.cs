namespace WebApplication3.Models
{
    public class MetaMaskXacThucDTO
    {
        public int Id { get; set; }
        public int TaiKhoanId { get; set; }
        public string? DiaChiVi { get; set; }
        public DateTime ThoiGianTao { get; set; }
        public string? TenDangNhap { get; set; }
        public string? Email { get; set; }
        public string? Nonce { get; set; }       // Thêm Nonce
        public string? Signature { get; set; }   // Thêm Signature
    }
}