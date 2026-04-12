
using WebApplication3.Models;

public class TaiKhoanNoRefreshTokenDTO
{
    public int Id { get; set; }

    public string? Email { get; set; } = null!;
    public bool? TrangThai { get; set; }
    public DateOnly? NgayThamGia { get; set; }
    public string? TenDangNhap { get; set; }
    public string? HoTen { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    public List<VaiTroDTO>? VaiTro { get; set; }
}
