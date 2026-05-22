public class TaiKhoanVaiTroAdminDTO
{
    public int Id { get; set; }
    public int TaiKhoanId { get; set; }
    public int VaiTroId { get; set; }
    public string TenDangNhap { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool TrangThai { get; set; }
    public string TenVaiTro { get; set; } = string.Empty;
}

