namespace WebApplication3.Models
{
    public class WalletLoginDTO
    {
        public string? DiaChiVi { get; set; }
        public string? Nonce { get; set; }
        public string? Signature { get; set; }
        public string? RecaptchaToken { get; set; }
    }
}
