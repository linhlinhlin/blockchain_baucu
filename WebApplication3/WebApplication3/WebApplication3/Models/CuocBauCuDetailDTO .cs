namespace WebApplication3.Models
{
    public class CuocBauCuDetailDTO : CuocBauCuDTO
    {
        public new string? AnhCuocBauCu { get; set; }
        public new long? BlockchainServerId { get; set; }
        public new string? BlockchainAddress { get; set; }
        public int TrangThaiBlockchain { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
