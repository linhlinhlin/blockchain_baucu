namespace WebApplication3.Models
{
    public class ViTriUngCuDTO
    {
        public int Id { get; set; }
        public string TenViTriUngCu { get; set; } = null!;
        public int SoPhieuToiDa { get; set; }
        public string? MoTa { get; set; } // Thêm trường mô tả
        public int? PhienBauCuId { get; set; }
        public int CuocBauCuId { get; set; }
    }
}