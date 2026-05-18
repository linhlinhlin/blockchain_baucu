namespace WebApplication3.Models;

public sealed class DevelopmentAuthUserRecord
{
    public int Id { get; set; }
    public string TenDangNhap { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string TenHienThi { get; set; } = string.Empty;
    public string VaiTro { get; set; } = "Nguoi Dung";
    public bool TrangThai { get; set; }
    public bool IsMetaMask { get; set; }
    public string? DiaChiVi { get; set; }
    public DateOnly NgayThamGia { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public DateOnly? LanDangNhapCuoi { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public ICollection<DevelopmentAuthSessionRecord> Sessions { get; set; } = new List<DevelopmentAuthSessionRecord>();
}

public sealed class DevelopmentAuthSessionRecord
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string RefreshTokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAtUtc { get; set; }
    public DevelopmentAuthUserRecord? User { get; set; }
}
