namespace WebApplication3.Models
{
    public class CuocBauCuDetailDTO : CuocBauCuDTO
    {
        public string? AnhCuocBauCu { get; set; }
        public long? BlockchainServerId { get; set; }
        public string? BlockchainAddress { get; set; }
        public int TrangThaiBlockchain { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
