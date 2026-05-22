namespace WebApplication3.Models
{
    public class ViBlockchainDTO
    {
        public int ViId { get; set; }
        public int TaiKhoanId { get; set; }
        public string DiaChiVi { get; set; } = string.Empty;
        public byte LoaiVi { get; set; } // 0: Không xác định, 1: MetaMask, 2: SCW
        public long? SCWNonce { get; set; }
        public DateTime ThoiGianTao { get; set; }
        public bool? TrangThai { get; set; }
        public bool IsPrimaryWallet { get; set; }
        public string NguonTao { get; set; } = string.Empty;
    }
}
