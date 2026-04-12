using Nethereum.Web3.Accounts;
using System.Security.Cryptography;
using System.Text;
using SHA3.Net;
using Microsoft.Extensions.Logging;

namespace WebApplication3.Services
{
    public class CryptoService
    {
        private readonly ILogger<CryptoService> _logger;

        public CryptoService(ILogger<CryptoService> logger)
        {
            _logger = logger;
        }

        public string GenerateEOAFromCredentials(string username, string password, string serverSecret)
        {
            string input = $"{username}:{password}";
            byte[] salt = Encoding.UTF8.GetBytes(serverSecret);

            try
            {
                using (var pbkdf2 = new Rfc2898DeriveBytes(input, salt, 10000, HashAlgorithmName.SHA256))
                {
                    byte[] derivedKey = pbkdf2.GetBytes(32);
                    var ethAccount = new Account(derivedKey);
                    _logger.LogInformation("Tạo EOA thành công cho username: {Username}", username);
                    return ethAccount.Address;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo EOA từ credentials cho username: {Username}", username);
                throw;
            }
        }

        public string GenerateSalt(string userId)
        {
            try
            {
                byte[] hashBytes = Sha3.Sha3256().ComputeHash(Encoding.UTF8.GetBytes(userId));
                string salt = "0x" + BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
                _logger.LogInformation("Tạo salt thành công cho userId: {UserId}", userId);
                return salt;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo salt cho userId: {UserId}", userId);
                throw;
            }
        }
    }
}