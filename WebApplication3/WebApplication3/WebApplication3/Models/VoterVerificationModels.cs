using System;

namespace WebApplication3.Models
{
    /// <summary>
    /// Model dùng cho request gửi email xác thực cử tri
    /// </summary>
    public class VoterVerificationRequest
    {
        public string Email { get; set; }
        public int PhienBauCuId { get; set; }
        public int CuocBauCuId { get; set; }
    }

    /// <summary>
    /// Model lưu trữ thông tin xác thực
    /// </summary>
    public class VerificationModel
    {
        public string Email { get; set; }
        public string Token { get; set; }
        public int PhienBauCuId { get; set; }
        public int CuocBauCuId { get; set; }
        public DateTime ExpiryTime { get; set; }
    }

    /// <summary>
    /// Model dùng cho response xác thực cử tri
    /// </summary>
    public class VoterVerificationResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public bool HasAccount { get; set; }
        public bool HasWallet { get; set; }
        public int? AccountId { get; set; }
    }
}