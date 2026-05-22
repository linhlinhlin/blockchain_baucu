namespace WebApplication3.Models
{
    public class CustomLoginResponseDTO
    {
        public int Id { get; set; }
        public string TenDangNhap { get; set; } = string.Empty;
        public string HoTen { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool TrangThai { get; set; }
        public string NgayThamGia { get; set; } = string.Empty;
        public string LanDangNhapCuoi { get; set; } = string.Empty;
        public string? RefreshToken { get; set; }
        public string? RefreshTokenExpiryTime { get; set; }
        public VaiTroDTO VaiTro { get; set; } = null!;
        public List<object> CuocBauCus { get; set; } = new List<object>(); // Giả sử là danh sách rỗng
        public bool IsMetaMask { get; set; }
        public string TenHienThi { get; set; } = string.Empty;
        public string? DiaChiVi { get; set; } // Đây sẽ là ví SCW
    }

}
