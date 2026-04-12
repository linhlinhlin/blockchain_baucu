namespace WebApplication3.Models
{
    public class UngCuVienDTO
    {
        public int Id { get; set; }
        public string HoTen { get; set; } = null!;
        public string? Anh { get; set; }
        public string MoTa { get; set; } = null!;
        public int ViTriUngCuId { get; set; }
        public int CuocBauCuId { get; set; }
        public int? PhienBauCuId { get; set; }
        public int? TaiKhoanId { get; set; } // Thêm trường mới
        public int? CuTriId { get; set; } // Thêm trường mới
    }
}