namespace WebApplication3.Models
{
    // DTO mở rộng để bao gồm URL ảnh
    public class UngCuVienWithImageDTO : UngCuVienDTO
    {
        public string AnhUrl { get; set; } = string.Empty;
        public object? FileInfo { get; set; }
    }
}
