namespace WebApplication3.Models
{
    public class LoginResponseDTO
    {
        public bool Success { get; set; }
        public string AccessToken { get; set; }
        public TaiKhoanDTO User { get; set; }
        public List<ViBlockchainDTO> Wallets { get; set; } = new List<ViBlockchainDTO>();
        public string Message { get; set; }
        public string? SCWAddress { get; set; }
    }
}
