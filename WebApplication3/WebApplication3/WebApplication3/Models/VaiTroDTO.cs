namespace WebApplication3.Models
{
    public class VaiTroDTO
    {
        public int Id { get; set; }
        public string? TenVaiTro { get; set; }
        public List<ChucNangDTO>? ChucNangs { get; set; }
    }
}
