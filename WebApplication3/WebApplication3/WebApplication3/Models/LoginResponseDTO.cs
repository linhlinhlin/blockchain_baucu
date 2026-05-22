namespace WebApplication3.Models
{
    public class LoginResponseDTO
    {
        public bool Success { get; set; }
        public string AccessToken { get; set; } = string.Empty;
        public TaiKhoanDTO User { get; set; } = null!;
        public List<ViBlockchainDTO> Wallets { get; set; } = new List<ViBlockchainDTO>();
        public string Message { get; set; } = string.Empty;
        public string? SCWAddress { get; set; }
    }
}
