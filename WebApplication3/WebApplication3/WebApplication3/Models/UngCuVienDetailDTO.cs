namespace WebApplication3.Models
{
    public class UngCuVienDetailDTO
    {
        public int Id { get; set; }
        public string HoTen { get; set; } = null!;
        public string? Anh { get; set; }
        public string MoTa { get; set; } = null!;
        public int ViTriUngCuId { get; set; }
        public string? TenViTriUngCu { get; set; }
        public int CuocBauCuId { get; set; }
        public string? TenCuocBauCu { get; set; }
        public int? PhienBauCuId { get; set; }
        public string? TenPhienBauCu { get; set; }
        public int? TaiKhoanId { get; set; }
        public string? TenTaiKhoan { get; set; }
        public int? CuTriId { get; set; }
        public string? EmailCuTri { get; set; }
        public string? AnhUrl { get; set; } // URL hình ảnh đã xử lý SAS token
        public string? DiaChiVi { get; set; } // Địa chỉ ví blockchain
    }
}