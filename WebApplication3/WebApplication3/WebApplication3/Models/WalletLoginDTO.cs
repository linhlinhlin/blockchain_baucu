namespace WebApplication3.Models
{
    public class WalletLoginDTO
    {
        public string? DiaChiVi { get; set; }
        public string? Nonce { get; set; }
        public string? Signature { get; set; }
        public string? RecaptchaToken { get; set; }
    }

    public class WalletLoginNonceRequestDTO
    {
        public string? DiaChiVi { get; set; }
    }

    public class WalletLoginNonceResponseDTO
    {
        public bool Success { get; set; }
        public string DiaChiVi { get; set; } = string.Empty;
        public string Nonce { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTimeOffset ExpiresAtUtc { get; set; }
    }
}
