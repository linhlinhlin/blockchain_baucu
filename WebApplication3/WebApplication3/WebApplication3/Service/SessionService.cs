using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Web3;
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using WebApplication3.Contracts;
using WebApplication3.Data;
using WebApplication3.Models;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Web3.Accounts;
using Nethereum.RPC.Eth.DTOs;
using Nethereum.Hex.HexTypes;

namespace WebApplication3.Services
{
    public class SessionService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SessionService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _rpcUrl;
        private static readonly ConcurrentDictionary<string, DateTime> _failedAttempts = new();

        public SessionService(
            ApplicationDbContext context,
            ILogger<SessionService> logger,
            IConfiguration configuration)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _rpcUrl = configuration["BlockchainSettings:RpcUrl"];
            if (string.IsNullOrEmpty(_rpcUrl))
            {
                _logger.LogError("RPC URL không được cấu hình trong appsettings.json.");
                throw new ArgumentNullException(nameof(_rpcUrl), "RPC URL không được cấu hình.");
            }
        }

        private string EncryptPrivateKey(string privateKey, string salt)
        {
            using var aes = Aes.Create();
            var key = new Rfc2898DeriveBytes(
                _configuration["BlockchainSettings:ServerSecret"] ?? "holihu_secure_key",
                Encoding.UTF8.GetBytes(salt),
                10000,
                HashAlgorithmName.SHA256
            ).GetBytes(32);

            aes.Key = key;
            aes.GenerateIV();

            using var encryptor = aes.CreateEncryptor();
            using var ms = new MemoryStream();
            using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
            using (var sw = new StreamWriter(cs))
            {
                sw.Write(privateKey);
            }

            var iv = aes.IV;
            var encryptedData = ms.ToArray();
            var result = new byte[iv.Length + encryptedData.Length];
            Buffer.BlockCopy(iv, 0, result, 0, iv.Length);
            Buffer.BlockCopy(encryptedData, 0, result, iv.Length, encryptedData.Length);

            return Convert.ToBase64String(result);
        }

        private string DecryptPrivateKey(string encryptedPrivateKey, string salt)
        {
            var fullData = Convert.FromBase64String(encryptedPrivateKey);

            using var aes = Aes.Create();
            var key = new Rfc2898DeriveBytes(
                _configuration["BlockchainSettings:ServerSecret"] ?? "holihu_secure_key",
                Encoding.UTF8.GetBytes(salt),
                10000,
                HashAlgorithmName.SHA256
            ).GetBytes(32);

            aes.Key = key;

            byte[] iv = new byte[aes.BlockSize / 8];
            byte[] encryptedData = new byte[fullData.Length - iv.Length];

            Buffer.BlockCopy(fullData, 0, iv, 0, iv.Length);
            Buffer.BlockCopy(fullData, iv.Length, encryptedData, 0, encryptedData.Length);

            aes.IV = iv;

            using var decryptor = aes.CreateDecryptor();
            using var ms = new MemoryStream(encryptedData);
            using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using var sr = new StreamReader(cs);

            return sr.ReadToEnd();
        }

        public async Task<KhoaPhienDTO> CreateSessionKey(int taiKhoanID, int viID)
        {
            string attemptKey = $"{taiKhoanID}:{viID}";
            if (_failedAttempts.TryGetValue(attemptKey, out DateTime lastFailure) &&
                DateTime.UtcNow.Subtract(lastFailure).TotalMinutes < 5)
            {
                _logger.LogWarning("Đã thất bại khi tạo session key gần đây cho TaiKhoanID {TaiKhoanID} và ViID {ViID}. Chờ 5 phút.", taiKhoanID, viID);
                throw new Exception("Thất bại khi tạo session key gần đây. Vui lòng thử lại sau 5 phút.");
            }

            var vi = await _context.ViBlockchain
                .FirstOrDefaultAsync(v => v.ViId == viID && v.TaiKhoanId == taiKhoanID && v.LoaiVi == 2);
            if (vi == null)
            {
                _logger.LogError("Ví không hợp lệ, không phải SCW hoặc không thuộc tài khoản này. ViID: {ViID}, TaiKhoanID: {TaiKhoanID}", viID, taiKhoanID);
                throw new ArgumentException("Ví không hợp lệ hoặc không thuộc tài khoản này.");
            }

            var adminPrivateKey = _configuration["BlockchainSettings:AdminPrivateKey"];
            if (string.IsNullOrEmpty(adminPrivateKey))
            {
                _logger.LogError("Không tìm thấy Admin Private Key trong cấu hình");
                throw new ArgumentException("Admin Private Key không được cấu hình.");
            }

            var adminAccount = new Nethereum.Web3.Accounts.Account(adminPrivateKey);
            var web3 = new Web3(adminAccount, _rpcUrl);
            var scwContract = web3.Eth.GetContract(ContractABIs.SimpleAccountNe, vi.DiaChiVi);
            var setSessionKeyFunction = scwContract.GetFunction("setSessionKey");

            var sessionKeyWallet = new Nethereum.Web3.Accounts.Account(Nethereum.Signer.EthECKey.GenerateKey());
            string sessionKeyAddress = sessionKeyWallet.Address;
            string sessionKeyPrivateKey = sessionKeyWallet.PrivateKey;
            var thoiHan = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds();

            try
            {
                var gasLimit = new HexBigInteger(100000);
                var gasPrice = await web3.Eth.GasPrice.SendRequestAsync();

                var txHash = await setSessionKeyFunction.SendTransactionAsync(
                    adminAccount.Address,
                    gasLimit,
                    gasPrice,
                    null,
                    sessionKeyAddress,
                    thoiHan
                );

                _logger.LogInformation("Đã gửi giao dịch setSessionKey cho SCW {DiaChiVi} với session key {SessionKeyAddress}. TxHash: {TxHash}", vi.DiaChiVi, sessionKeyAddress, txHash);

                var receipt = await web3.TransactionManager.TransactionReceiptService
                    .PollForReceiptAsync(txHash, new CancellationTokenSource(TimeSpan.FromMinutes(5)).Token);
                if (receipt == null || receipt.Status.Value != 1)
                {
                    var reason = await GetTransactionError(web3, txHash);
                    _logger.LogError("Giao dịch setSessionKey thất bại. TxHash: {TxHash}, Reason: {Reason}", txHash, reason);
                    throw new Exception($"Giao dịch setSessionKey thất bại: {reason}. TxHash: {txHash}");
                }

                var salt = $"{taiKhoanID}:{viID}:{thoiHan}";
                var encryptedPrivateKey = EncryptPrivateKey(sessionKeyPrivateKey, salt);

                // Remove "0x" prefix if present
                if (encryptedPrivateKey.StartsWith("0x"))
                {
                    encryptedPrivateKey = encryptedPrivateKey.Substring(2);
                }

                var khoaPhien = new KhoaPhien
                {
                    TaiKhoanID = taiKhoanID,
                    ViID = viID,
                    Khoa = encryptedPrivateKey,
                    ThoiHanUnix = thoiHan,
                    ThoiHan = DateTimeOffset.FromUnixTimeSeconds(thoiHan).UtcDateTime
                };
                _context.KhoaPhiens.Add(khoaPhien);
                await _context.SaveChangesAsync();

                _failedAttempts.TryRemove(attemptKey, out _);
                _logger.LogInformation("Tạo khóa phiên thành công cho TaiKhoanID {TaiKhoanID} tại ViID {ViID}, TxHash: {TxHash}", taiKhoanID, viID, txHash);

                return new KhoaPhienDTO
                {
                    MaKhoaID = khoaPhien.MaKhoaID,
                    DiaChiSCW = vi.DiaChiVi,
                    SessionKey = sessionKeyPrivateKey, // Trả khóa chưa mã hóa cho DTO
                    ExpiresAt = thoiHan
                };
            }
            catch (Exception ex)
            {
                _failedAttempts[attemptKey] = DateTime.UtcNow;
                _logger.LogError(ex, "Lỗi khi tạo khóa phiên: DiaChiVi: {DiaChiVi}, TaiKhoanID: {TaiKhoanID}, ViID: {ViID}", vi.DiaChiVi, taiKhoanID, viID);
                throw;
            }
        }

        public async Task<KhoaPhienDTO> GetValidSessionKey(int taiKhoanID, int viID)
        {
            var khoaPhien = await _context.KhoaPhiens
                .Include(k => k.ViBlockchain)
                .FirstOrDefaultAsync(s => s.TaiKhoanID == taiKhoanID && s.ViID == viID && s.ThoiHan > DateTime.UtcNow);

            if (khoaPhien == null)
            {
                _logger.LogWarning("Không tìm thấy khóa phiên hợp lệ cho TaiKhoanID {TaiKhoanID} tại ViID {ViID}", taiKhoanID, viID);
                return null;
            }

            var salt = $"{taiKhoanID}:{viID}:{khoaPhien.ThoiHanUnix}";
            try
            {
                var decryptedKey = DecryptPrivateKey(khoaPhien.Khoa, salt);
                return new KhoaPhienDTO
                {
                    MaKhoaID = khoaPhien.MaKhoaID,
                    DiaChiSCW = khoaPhien.ViBlockchain.DiaChiVi,
                    SessionKey = decryptedKey, // Trả khóa đã giải mã
                    ExpiresAt = khoaPhien.ThoiHanUnix // Unix timestamp
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi giải mã khóa phiên: MaKhoaID {MaKhoaID}", khoaPhien.MaKhoaID);
                return null;
            }
        }

        public async Task<KhoaPhien> GetValidSessionKeyEntity(int taiKhoanID, int viID)
        {
            var khoaPhienFromDb = await _context.KhoaPhiens
                .Where(s => s.TaiKhoanID == taiKhoanID && s.ViID == viID && s.ThoiHan > DateTime.UtcNow)
                .OrderByDescending(s => s.ThoiHanUnix) // Lấy bản mới nhất
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (khoaPhienFromDb != null)
            {
                var salt = $"{khoaPhienFromDb.TaiKhoanID}:{khoaPhienFromDb.ViID}:{khoaPhienFromDb.ThoiHanUnix}";
                try
                {
                    _logger.LogInformation("Decrypting Khoa: {Khoa}, Salt: {Salt}", khoaPhienFromDb.Khoa, salt);
                    var decryptedKey = DecryptPrivateKey(khoaPhienFromDb.Khoa, salt);

                    var khoaPhienCopy = new KhoaPhien
                    {
                        MaKhoaID = khoaPhienFromDb.MaKhoaID,
                        TaiKhoanID = khoaPhienFromDb.TaiKhoanID,
                        ViID = khoaPhienFromDb.ViID,
                        Khoa = decryptedKey, // Gán khóa đã giải mã
                        ThoiHan = khoaPhienFromDb.ThoiHan,
                        ThoiHanUnix = khoaPhienFromDb.ThoiHanUnix
                    };

                    _logger.LogInformation("Decrypted session key: {Key}", decryptedKey);
                    return khoaPhienCopy;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi giải mã khóa phiên: MaKhoaID {MaKhoaID}", khoaPhienFromDb.MaKhoaID);
                    return null;
                }
            }
            else
            {
                _logger.LogWarning("Không tìm thấy khóa phiên hợp lệ cho TaiKhoanID {TaiKhoanID} tại ViID {ViID}", taiKhoanID, viID);
            }

            return null;
        }

        private async Task<string> GetTransactionError(Web3 web3, string txHash)
        {
            try
            {
                var tx = await web3.Eth.Transactions.GetTransactionByHash.SendRequestAsync(txHash);
                var result = await web3.Eth.Transactions.Call.SendRequestAsync(new CallInput
                {
                    From = tx.From,
                    To = tx.To,
                    Gas = tx.Gas,
                    Value = tx.Value,
                    Data = tx.Input
                }, new BlockParameter(tx.BlockNumber));
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy reason của giao dịch thất bại: {TxHash}", txHash);
                return "Không thể lấy lý do thất bại";
            }
        }

        internal async Task RenewSessionKey(int taiKhoanID, int viID)
        {
            var existingKey = await GetValidSessionKeyEntity(taiKhoanID, viID);
            if (existingKey != null && existingKey.ThoiHan > DateTime.UtcNow.AddHours(-1))
            {
                _logger.LogInformation("Khóa phiên hiện tại cho TaiKhoanID {TaiKhoanID} tại ViID {ViID} vẫn còn hợp lệ.", taiKhoanID, viID);
                return;
            }

            _logger.LogInformation("Gia hạn khóa phiên cho TaiKhoanID {TaiKhoanID} tại ViID {ViID}", taiKhoanID, viID);
            await CreateSessionKey(taiKhoanID, viID);
        }
    }

    public class KhoaPhienDTO
    {
        public int MaKhoaID { get; set; }
        public string? DiaChiSCW { get; set; }
        public string? SessionKey { get; set; } // Khóa phiên (đã giải mã)
        public long ExpiresAt { get; set; } // Unix timestamp
        public DateTime ThoiHan { get; set; }
        public int TaiKhoanID { get; set; }
    }
}