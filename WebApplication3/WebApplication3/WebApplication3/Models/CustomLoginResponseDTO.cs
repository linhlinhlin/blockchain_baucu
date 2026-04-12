namespace WebApplication3.Models
{
    public class CustomLoginResponseDTO
    {
        public int Id { get; set; }
        public string TenDangNhap { get; set; }
        public string HoTen { get; set; } = null;
        public string Email { get; set; }
        public bool TrangThai { get; set; }
        public string NgayThamGia { get; set; }
        public string LanDangNhapCuoi { get; set; }
        public string RefreshToken { get; set; } = null;
        public string RefreshTokenExpiryTime { get; set; } = null;
        public VaiTroDTO VaiTro { get; set; }
        public List<object> CuocBauCus { get; set; } = new List<object>(); // Giả sử là danh sách rỗng
        public bool IsMetaMask { get; set; }
        public string TenHienThi { get; set; }
        public string DiaChiVi { get; set; } // Đây sẽ là ví SCW
    }

}
