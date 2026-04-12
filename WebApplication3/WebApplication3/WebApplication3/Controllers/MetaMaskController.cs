using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Nethereum.Signer;
using System.Security.Claims;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [Route("api/metamask")]
    [ApiController]
    public class MetaMaskController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MetaMaskController> _logger;

        public MetaMaskController(ApplicationDbContext context, ILogger<MetaMaskController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// DTO cho request liên kết MetaMask.
        /// </summary>
        public class LinkMetaMaskRequestDTO
        {
            public string DiaChiVi { get; set; }
            public string Nonce { get; set; }
            public string Signature { get; set; }
        }

        /// <summary>
        /// Liên kết ví MetaMask với tài khoản hiện tại.
        /// </summary>
        [HttpPost("link")]
        [Authorize]
        public async Task<IActionResult> LinkMetaMask([FromBody] LinkMetaMaskRequestDTO model)
        {
            try
            {
                // ✅ Kiểm tra đầu vào
                if (!IsValidWalletAddress(model.DiaChiVi) || string.IsNullOrEmpty(model.Nonce) || string.IsNullOrEmpty(model.Signature))
                {
                    _logger.LogWarning("Dữ liệu đầu vào không hợp lệ cho địa chỉ ví: {DiaChiVi}", model.DiaChiVi);
                    return BadRequest(new { success = false, message = "Dữ liệu đầu vào không hợp lệ (địa chỉ ví, nonce hoặc chữ ký không đúng)." });
                }

                // ✅ Xác minh chữ ký MetaMask
                if (!VerifyMetaMaskSignature(model.DiaChiVi, model.Nonce, model.Signature))
                {
                    _logger.LogWarning("Chữ ký MetaMask không hợp lệ cho ví: {DiaChiVi}", model.DiaChiVi);
                    return Unauthorized(new { success = false, message = "Chữ ký không hợp lệ." });
                }

                // ✅ Lấy UserId từ token
                if (!int.TryParse(User.FindFirst("UserID")?.Value, out int userId) || userId == 0)
                {
                    _logger.LogWarning("Không xác định được UserID từ token");
                    return Unauthorized(new { success = false, message = "Không xác định được người dùng từ token." });
                }

                // ✅ Kiểm tra tài khoản
                var user = await _context.TaiKhoan.FindAsync(userId);
                if (user == null)
                {
                    _logger.LogWarning("Không tìm thấy tài khoản cho UserID: {UserId}", userId);
                    return Unauthorized(new { success = false, message = "Tài khoản không tồn tại." });
                }

                // ✅ Kiểm tra ví đã được liên kết với tài khoản khác chưa
                var existingWallet = await _context.ViBlockchain
                    .FirstOrDefaultAsync(w => w.DiaChiVi.ToLower() == model.DiaChiVi.ToLower());
                if (existingWallet != null && existingWallet.TaiKhoanId != userId)
                {
                    _logger.LogWarning("Ví {DiaChiVi} đã được liên kết với tài khoản khác (UserID: {TaiKhoanId})", model.DiaChiVi, existingWallet.TaiKhoanId);
                    return BadRequest(new { success = false, message = "Ví MetaMask này đã được liên kết với một tài khoản khác." });
                }

                // ✅ Kiểm tra tài khoản đã có ví MetaMask chưa
                var userWallet = await _context.ViBlockchain
                    .FirstOrDefaultAsync(w => w.TaiKhoanId == userId && w.LoaiVi == 1); // 1 = MetaMask
                if (userWallet != null)
                {
                    _logger.LogWarning("Tài khoản {UserId} đã có ví MetaMask: {DiaChiVi}", userId, userWallet.DiaChiVi);
                    return BadRequest(new { success = false, message = "Tài khoản của bạn đã liên kết với một ví MetaMask." });
                }

                // ✅ Lưu vào database (dùng transaction)
                using (var transaction = await _context.Database.BeginTransactionAsync())
                {
                    var newWallet = new ViBlockchain
                    {
                        TaiKhoanId = userId,
                        DiaChiVi = model.DiaChiVi,
                        LoaiVi = 1, // 1: MetaMask
                        SCWNonce = null,
                        ThoiGianTao = DateTime.UtcNow,
                        TrangThai = true,
                        IsPrimaryWallet = true,
                        NguonTao = "metamask_link"
                    };
                    _context.ViBlockchain.Add(newWallet);

                    user.IsMetaMask = true;

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    // ✅ Trả về kết quả với ViBlockchainDTO
                    var walletDTO = new ViBlockchainDTO
                    {
                        ViId = newWallet.ViId,
                        TaiKhoanId = newWallet.TaiKhoanId,
                        DiaChiVi = newWallet.DiaChiVi,
                        LoaiVi = newWallet.LoaiVi,
                        SCWNonce = newWallet.SCWNonce,
                        ThoiGianTao = newWallet.ThoiGianTao,
                        TrangThai = newWallet.TrangThai,
                        IsPrimaryWallet = newWallet.IsPrimaryWallet,
                        NguonTao = newWallet.NguonTao
                    };

                    _logger.LogInformation("Liên kết ví MetaMask thành công cho UserID: {UserId}, DiaChiVi: {DiaChiVi}", userId, model.DiaChiVi);
                    return Ok(new { success = true, message = "Liên kết ví MetaMask thành công!", wallet = walletDTO });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi liên kết MetaMask cho ví {DiaChiVi}: {Message}", model?.DiaChiVi ?? "unknown", ex.Message);
                return StatusCode(500, new { success = false, message = "Lỗi hệ thống, vui lòng thử lại sau." });
            }
        }

        /// <summary>
        /// Tìm tài khoản dựa trên địa chỉ ví MetaMask.
        /// </summary>
        [HttpGet("find-by-wallet/{diaChiVi}")]
        [AllowAnonymous]
        public async Task<IActionResult> FindAccountByWallet(string diaChiVi)
        {
            try
            {
                // ✅ Kiểm tra địa chỉ ví hợp lệ
                if (!IsValidWalletAddress(diaChiVi))
                {
                    _logger.LogWarning("Địa chỉ ví không hợp lệ: {DiaChiVi}", diaChiVi);
                    return BadRequest(new { success = false, message = "Địa chỉ ví không hợp lệ." });
                }

                // ✅ Tìm ví trong bảng ViBlockchain
                var wallet = await _context.ViBlockchain
                    .FirstOrDefaultAsync(w => w.DiaChiVi.ToLower() == diaChiVi.ToLower() && w.LoaiVi == 1); // 1 = MetaMask

                if (wallet == null)
                {
                    _logger.LogInformation("Không tìm thấy ví MetaMask: {DiaChiVi}", diaChiVi);
                    return NotFound(new { success = false, message = "Không tìm thấy tài khoản liên kết với ví này." });
                }

                // ✅ Lấy thông tin tài khoản
                var user = await _context.TaiKhoan.FindAsync(wallet.TaiKhoanId);
                if (user == null)
                {
                    _logger.LogWarning("Tài khoản liên kết với ví {DiaChiVi} không tồn tại", diaChiVi);
                    return NotFound(new { success = false, message = "Tài khoản liên kết không tồn tại." });
                }

                // ✅ Lấy vai trò người dùng
                var role = await (from r in _context.Set<VaiTro>()
                                  join ur in _context.Set<TaiKhoanVaiTroAdmin>() on r.Id equals ur.VaiTroId
                                  where ur.TaiKhoanId == user.Id
                                  select new VaiTroDTO { TenVaiTro = r.TenVaiTro }).FirstOrDefaultAsync();

                var taiKhoanDTO = new TaiKhoanDTO
                {
                    Id = user.Id,
                    TenDangNhap = user.TenDangNhap,
                    Email = user.Email,
                    TrangThai = user.TrangThai,
                    NgayThamGia = (DateOnly)user.NgayThamGia,
                    LanDangNhapCuoi = user.LanDangNhapCuoi,
                    IsMetaMask = user.IsMetaMask
                };

                _logger.LogInformation("Tìm thấy tài khoản cho ví {DiaChiVi}: UserID {UserId}", diaChiVi, user.Id);
                return Ok(new { success = true, user = taiKhoanDTO, role = role?.TenVaiTro });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tìm tài khoản bằng ví {DiaChiVi}: {Message}", diaChiVi, ex.Message);
                return StatusCode(500, new { success = false, message = "Lỗi hệ thống, vui lòng thử lại sau." });
            }
        }

        /// <summary>
        /// Kiểm tra địa chỉ ví có hợp lệ không.
        /// </summary>
        private bool IsValidWalletAddress(string address)
        {
            return !string.IsNullOrEmpty(address) && address.StartsWith("0x") && address.Length == 42;
        }

        /// <summary>
        /// Xác minh chữ ký MetaMask.
        /// </summary>
        private bool VerifyMetaMaskSignature(string address, string nonce, string signature)
        {
            try
            {
                var signer = new EthereumMessageSigner();
                var recoveredAddress = signer.EncodeUTF8AndEcRecover(nonce, signature);
                return recoveredAddress.ToLower() == address.ToLower();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi xác minh chữ ký MetaMask cho địa chỉ {Address}: {Message}", address, ex.Message);
                return false;
            }
        }
    }
}