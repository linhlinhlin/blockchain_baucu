namespace WebApplication3.Models
{
    public class CuTriDTO
    {
        public int Id { get; set; }
        public string? Sdt { get; set; }
        public string? Email { get; set; }
        public bool XacMinh { get; set; }
        public bool? BoPhieu { get; set; }
        public int SoLanGuiOtp { get; set; }
        public int CuocBauCuId { get; set; }
        public int? PhienBauCuId { get; set; }
        public int? TaiKhoanId { get; set; }
        public int? VaiTroId { get; set; }

        // Thêm các trường bổ sung để hiển thị trong frontend
        public string? TrangThai => XacMinh ? "verified" : (SoLanGuiOtp > 0 ? "pending" : "not_sent");
        public string? TenVaiTro { get; set; }
        public bool HasBlockchainWallet { get; set; }
    }
}