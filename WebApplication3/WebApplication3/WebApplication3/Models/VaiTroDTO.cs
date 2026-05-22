namespace WebApplication3.Models
{
    public class VaiTroDTO
    {
        public int Id { get; set; }
        public string TenVaiTro { get; set; } = string.Empty;
        public List<ChucNangDTO> ChucNangs { get; set; } = new List<ChucNangDTO>();
    }
}
