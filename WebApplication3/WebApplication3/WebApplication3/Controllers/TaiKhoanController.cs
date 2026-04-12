using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WebApplication3.Models;
using X.PagedList;
using BCrypt.Net;
using PagedList.Core;
using WebApplication3.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using System;
using Nethereum.Signer;
using WebApplication3.Services;
using Nethereum.JsonRpc.Client;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;
using WebApplication3.Infrastructure;

namespace WebApplication3.Controllers
{
    [Route("api/tai-khoan")]
    [ApiController]
    public class TaiKhoanController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly JwtService _jwtService;
        private readonly JwtSettings _jwtSettings;
        private readonly IConfiguration _configuration;
        private readonly CryptoService _cryptoService;
        private readonly BlockchainService _blockchainService;
        private readonly RecaptchaService _recaptchaService; // Thêm RecaptchaService
        private readonly ILogger<TaiKhoanController> _logger;

        public TaiKhoanController(
            ApplicationDbContext context,
            IMapper mapper,
            JwtService jwtService,
            IOptions<JwtSettings> jwtSettings,
            IConfiguration configuration,
            CryptoService cryptoService,
            BlockchainService blockchainService,
            RecaptchaService recaptchaService, // Inject RecaptchaService
            ILogger<TaiKhoanController> logger)
        {
            _context = context;
            _mapper = mapper;
            _jwtService = jwtService;
            _jwtSettings = jwtSettings.Value;
            _configuration = configuration;
            _cryptoService = cryptoService;
            _blockchainService = blockchainService;
            _recaptchaService = recaptchaService;
            _logger = logger;
        }

        private bool IsDevelopmentAuthEnabled()
        {
            return _configuration.GetValue<bool>("DevelopmentAuthSettings:Enabled");
        }

        private IActionResult TaoPhanHoiDangNhapDevelopment(DevelopmentAuthUser user, int successStatusCode = 200)
        {
            var vaiTro = new VaiTroDTO
            {
                Id = 0,
                TenVaiTro = user.VaiTro
            };

            var taiKhoan = new TaiKhoan
            {
                Id = user.Id,
                TenDangNhap = user.TenDangNhap,
                Email = user.Email,
                TrangThai = user.TrangThai,
                NgayThamGia = user.NgayThamGia,
                LanDangNhapCuoi = user.LanDangNhapCuoi,
                TenHienThi = user.TenHienThi,
                IsMetaMask = user.IsMetaMask
            };

            var wallets = string.IsNullOrWhiteSpace(user.DiaChiVi)
                ? new List<ViBlockchain>()
                : new List<ViBlockchain>
                {
                    new ViBlockchain
                    {
                        ViId = 0,
                        TaiKhoanId = user.Id,
                        DiaChiVi = user.DiaChiVi!,
                        LoaiVi = 1,
                        SCWNonce = null,
                        ThoiGianTao = DateTime.UtcNow,
                        TrangThai = true,
                        IsPrimaryWallet = true,
                        NguonTao = "development_auth"
                    }
                };

            var claims = TaoClaimsNguoiDung(taiKhoan, vaiTro, wallets);
            var accessToken = _jwtService.GenerateAccessToken(claims);
            var refreshToken = _jwtService.GenerateRefreshToken();

            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
                Expires = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays)
            });

            return StatusCode(successStatusCode, new
            {
                Success = true,
                AccessToken = accessToken,
                User = TaoUserDto(taiKhoan, vaiTro, wallets),
                Wallets = wallets.Select(w => new
                {
                    w.ViId,
                    w.TaiKhoanId,
                    w.DiaChiVi,
                    w.LoaiVi,
                    w.SCWNonce,
                    w.ThoiGianTao,
                    w.TrangThai,
                    w.IsPrimaryWallet
                }).ToList()
            });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDTO model)
        {
            try
            {
                if (string.IsNullOrEmpty(model.TenDangNhap) || string.IsNullOrEmpty(model.MatKhau))
                {
                    _logger.LogWarning("Tên đăng nhập hoặc mật khẩu trống.");
                    return BadRequest(new { success = false, message = "Tên đăng nhập và mật khẩu không được để trống." });
                }

                if (IsDevelopmentAuthEnabled())
                {
                    var localUser = DevelopmentAuthStore.ValidateCredentials(model.TenDangNhap, model.MatKhau);
                    if (localUser == null)
                    {
                        return Unauthorized(new { success = false, message = "Tên đăng nhập hoặc mật khẩu không đúng." });
                    }

                    return TaoPhanHoiDangNhapDevelopment(localUser);
                }

                var recaptchaEnabled = _configuration.GetValue<bool>("RecaptchaSettings:Enabled");
                if (recaptchaEnabled)
                {
                    if (string.IsNullOrEmpty(model.RecaptchaToken))
                    {
                        _logger.LogWarning("Token reCAPTCHA trống cho TenDangNhap: {TenDangNhap}", model.TenDangNhap);
                        return BadRequest(new { success = false, message = "Token reCAPTCHA không được để trống." });
                    }

                    bool isRecaptchaValid = await _recaptchaService.VerifyRecaptchaAsync(model.RecaptchaToken, "login");
                    if (!isRecaptchaValid)
                    {
                        _logger.LogWarning("Xác minh reCAPTCHA thất bại cho TenDangNhap: {TenDangNhap}", model.TenDangNhap);
                        return BadRequest(new { success = false, message = "Xác minh reCAPTCHA không thành công, có thể bạn là bot." });
                    }
                }

                var user = await _context.TaiKhoan
                    .FirstOrDefaultAsync(u => u.TenDangNhap == model.TenDangNhap);
                if (user == null || !BCrypt.Net.BCrypt.Verify(model.MatKhau, user.MatKhau))
                {
                    _logger.LogWarning("Đăng nhập thất bại cho TenDangNhap: {TenDangNhap} - Thông tin không đúng.", model.TenDangNhap);
                    return Unauthorized(new { success = false, message = "Tên đăng nhập hoặc mật khẩu không đúng." });
                }

                if (!user.TrangThai)
                {
                    _logger.LogWarning("Tài khoản {TenDangNhap} đã bị khóa.", model.TenDangNhap);
                    return Unauthorized(new { success = false, message = "Tài khoản của bạn đã bị khóa." });
                }

                var role = await GetVaiTroNguoiDungAsync(user.Id);
                if (role == null)
                {
                    _logger.LogWarning("Người dùng {TenDangNhap} không có vai trò.", model.TenDangNhap);
                    return Unauthorized(new { success = false, message = "Người dùng không có vai trò." });
                }

                user.LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow);
                var wallets = await GetDanhSachViAsync(user.Id);
                return await TaoPhanHoiDangNhapAsync(user, role, wallets);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống khi xử lý đăng nhập cho TenDangNhap: {TenDangNhap}: {Message}", model.TenDangNhap, ex.Message);
                return StatusCode(500, new { success = false, message = "Lỗi hệ thống, vui lòng thử lại sau." });
            }
        }

        // Sửa phương thức RefreshToken
        [HttpPost("refresh-token")]
        [AllowAnonymous]
        public async Task<IActionResult> RefreshToken()
        {
            try
            {
                // Lấy Refresh Token từ Cookie
                if (!Request.Cookies.TryGetValue("refreshToken", out string? refreshToken) || string.IsNullOrEmpty(refreshToken))
                {
                    return Unauthorized("Không tìm thấy Refresh Token.");
                }

                // Lấy danh sách tất cả phiên đăng nhập trong DB
                var allSessions = await _context.PhienDangNhaps.ToListAsync();

                // Duyệt từng phiên, giải mã token và so sánh với refreshToken từ request
                var matchedSession = allSessions
                    .Select(session => new
                    {
                        Session = session,
                        DecryptedToken = _jwtService.DecryptToken(session.DuLieuPhien) // Giải mã token trong DB
                    })
                    .FirstOrDefault(t => t.DecryptedToken == refreshToken);

                if (matchedSession == null)
                {
                    return Unauthorized("Refresh Token không hợp lệ.");
                }

                var phienDangNhap = matchedSession.Session;
                var user = await _context.TaiKhoan.FindAsync(phienDangNhap.TaiKhoanId);

                if (user == null)
                {
                    return Unauthorized("Người dùng không tồn tại.");
                }

                if (phienDangNhap.NgayHetHan < DateTime.UtcNow)
                {
                    return Unauthorized("Refresh Token đã hết hạn, vui lòng đăng nhập lại.");
                }

                // Truy vấn SQL để lấy danh sách vai trò của người dùng
                var role = await (from r in _context.Set<VaiTro>()
                                  join ur in _context.Set<TaiKhoanVaiTroAdmin>() on r.Id equals ur.VaiTroId
                                  where ur.TaiKhoanId == user.Id
                                  select new VaiTroDTO { TenVaiTro = r.TenVaiTro }).FirstOrDefaultAsync();

                if (role == null)
                {
                    return Unauthorized("Người dùng không có vai trò.");
                }

                // Lấy địa chỉ ví SCW
                string scwAddress = null;
                var wallets = await _context.ViBlockchain
                    .Where(w => w.TaiKhoanId == user.Id)
                    .ToListAsync();

                var scwWallet = wallets.FirstOrDefault(w => w.LoaiVi == 2); // LoaiVi == 2 là SCW
                if (scwWallet != null)
                {
                    scwAddress = scwWallet.DiaChiVi;
                }

                // Tạo danh sách claims
                var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.TenDangNhap),
            new Claim("UserID", user.Id.ToString()),
            new Claim(ClaimTypes.Role, role.TenVaiTro)
        };

                // Thêm wallet claims
                foreach (var wallet in wallets)
                {
                    claims.Add(new Claim("DiaChiVi", wallet.DiaChiVi));
                    claims.Add(new Claim("LoaiVi", wallet.LoaiVi.ToString()));
                }

                if (!string.IsNullOrEmpty(scwAddress))
                {
                    claims.Add(new Claim("SCWAddress", scwAddress));
                }

                // Tạo Access Token mới
                var newAccessToken = _jwtService.GenerateAccessToken(claims);

                // Cập nhật lại refreshToken để đảm bảo bảo mật
                phienDangNhap.DuLieuPhien = _jwtService.EncryptToken(refreshToken);
                phienDangNhap.NgayHetHan = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays);
                await _context.SaveChangesAsync();

                // Tạo đối tượng TaiKhoanDTO để trả về frontend
                var taiKhoanDTO = new TaiKhoanDTO
                {
                    Id = user.Id,
                    TenDangNhap = user.TenDangNhap,
                    Email = user.Email,
                    TrangThai = user.TrangThai,
                    NgayThamGia = user.NgayThamGia.HasValue ? (DateOnly)user.NgayThamGia.Value : default(DateOnly),
                    LanDangNhapCuoi = user.LanDangNhapCuoi,
                    RefreshToken = user.RefreshToken,
                    RefreshTokenExpiryTime = user.RefreshTokenExpiryTime,
                    VaiTro = role, // Trả về vai trò dưới dạng đối tượng VaiTroDTO,
                    IsMetaMask = user.IsMetaMask,
                    DiaChiVi = scwAddress // Thêm địa chỉ SCW
                };

                return Ok(new
                {
                    AccessToken = newAccessToken,
                    User = taiKhoanDTO
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi máy chủ: {ex.Message}");
            }
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                // 🔹 Lấy Refresh Token từ Cookie
                if (!Request.Cookies.TryGetValue("refreshToken", out string? refreshToken) || string.IsNullOrEmpty(refreshToken))
                {
                    return Unauthorized("Không tìm thấy Refresh Token.");
                }

                // 🔹 Lấy tất cả phiên đăng nhập từ database
                var allSessions = await _context.PhienDangNhaps.ToListAsync();

                // 🔹 Giải mã và tìm phiên đăng nhập trùng với refresh token từ request
                var matchedSession = allSessions
                    .Select(session => new
                    {
                        Session = session,
                        DecryptedToken = _jwtService.DecryptToken(session.DuLieuPhien) // Giải mã refresh token lưu trong DB
                    })
                    .FirstOrDefault(t => t.DecryptedToken == refreshToken);

                if (matchedSession == null)
                {
                    return Unauthorized("Refresh Token không hợp lệ.");
                }

                var phienDangNhap = matchedSession.Session;
                var user = await _context.TaiKhoan.FindAsync(phienDangNhap.TaiKhoanId);

                if (user == null)
                {
                    return Unauthorized("Người dùng không tồn tại.");
                }

                // 🔹 Xóa phiên đăng nhập khỏi database
                _context.PhienDangNhaps.Remove(phienDangNhap);
                await _context.SaveChangesAsync();

                // 🔹 Xóa Refresh Token khỏi cookie
                Response.Cookies.Delete("refreshToken", new CookieOptions
                {
                    HttpOnly = true,  // Ngăn JavaScript đọc token
                    Secure = true,    // Chỉ hoạt động trên HTTPS
                    SameSite = SameSiteMode.Strict // Ngăn chặn CSRF
                });

                return Ok(new { message = "Đăng xuất thành công!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi máy chủ: {ex.Message}");
            }
        }



        [HttpPost("revoke-token")]
        [Authorize]
        public async Task<IActionResult> RevokeToken([FromBody] RevokeTokenDTO model)
        {
            if (string.IsNullOrEmpty(model.RefreshToken))
            {
                return BadRequest("Refresh token is required.");
            }

            var users = await _context.TaiKhoan
                .Where(x => x.RefreshToken != null).ToListAsync();

            var user = users.SingleOrDefault(x => x.RefreshToken != null && _jwtService.DecryptToken(x.RefreshToken) == model.RefreshToken);
            if (user == null)
            {
                return NotFound();
            }

            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            await _context.SaveChangesAsync();

            // Xóa lịch sử Refresh Token
            var phienDangNhap = await _context.PhienDangNhaps
                .FirstOrDefaultAsync(p => p.TaiKhoanId == user.Id && p.DuLieuPhien == model.RefreshToken);
            if (phienDangNhap != null)
            {
                _context.PhienDangNhaps.Remove(phienDangNhap);
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        // Modify the SearchTaiKhoan method to use ToPagedListAsync instead of ToPagedList
        [AllowAnonymous]
        [HttpGet("search")]
        public async Task<ActionResult> SearchTaiKhoan(
            string? tenDangNhap = null,
            int? id = null,
            int page = 1,
            int pageSize = 100)
        {
            if (IsDevelopmentAuthEnabled())
            {
                var users = DevelopmentAuthStore.Search(tenDangNhap, id)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(user => new
                    {
                        Id = user.Id,
                        TenDangNhap = user.TenDangNhap,
                        Email = user.Email,
                        TrangThai = user.TrangThai,
                        TenHienThi = user.TenHienThi,
                        IsMetaMask = user.IsMetaMask,
                        VaiTro = new[] { new VaiTroDTO { Id = 0, TenVaiTro = user.VaiTro } }
                    })
                    .ToList();

                return Ok(new
                {
                    totalData = users.Count,
                    pageSize,
                    pageIndex = page,
                    data = users
                });
            }

            var query = _context.TaiKhoan.AsQueryable();

            query = query.Where(tk =>
                (string.IsNullOrEmpty(tenDangNhap) || tk.TenDangNhap.Contains(tenDangNhap)) &&
                (!id.HasValue || tk.Id == id.Value)
            );

            int totalData = await query.CountAsync();

            var pagedList = await Task.Run(() => query.OrderBy(tk => tk.Id).ToPagedList(page, pageSize));

            var taiKhoanDTOs = new List<TaiKhoanNoRefreshTokenDTO>();

            foreach (var taiKhoan in pagedList)
            {
                // Truy vấn để lấy vai trò của người dùng
                var roles = await (from r in _context.Set<VaiTro>()
                                   join ur in _context.Set<TaiKhoanVaiTroAdmin>() on r.Id equals ur.VaiTroId
                                   where ur.TaiKhoanId == taiKhoan.Id
                                   select new VaiTroDTO { TenVaiTro = r.TenVaiTro }).ToListAsync();

                var taiKhoanDTO = _mapper.Map<TaiKhoanNoRefreshTokenDTO>(taiKhoan);
                taiKhoanDTO.VaiTro = roles;
                taiKhoanDTOs.Add(taiKhoanDTO);
            }

            return Ok(new
            {
                totalData,
                pageSize,
                pageIndex = page,
                data = taiKhoanDTOs
            });
        }

        [HttpGet("cac-tai-khoan")]
        [Authorize(Roles = "Quan Tri Vien")]
        public async Task<ActionResult<IEnumerable<TaiKhoanNoRefreshTokenDTO>>> GetAllTaiKhoan()
        {
            var taiKhoans = await _context.TaiKhoan.ToListAsync();
            var taiKhoanDTOs = new List<TaiKhoanNoRefreshTokenDTO>();

            foreach (var taiKhoan in taiKhoans)
            {
                // Truy vấn để lấy vai trò của người dùng
                var roles = await (from r in _context.Set<VaiTro>()
                                   join ur in _context.Set<TaiKhoanVaiTroAdmin>() on r.Id equals ur.VaiTroId
                                   where ur.TaiKhoanId == taiKhoan.Id
                                   select new VaiTroDTO { TenVaiTro = r.TenVaiTro }).ToListAsync();

                var taiKhoanDTO = _mapper.Map<TaiKhoanNoRefreshTokenDTO>(taiKhoan);
                taiKhoanDTO.VaiTro = roles;
                taiKhoanDTOs.Add(taiKhoanDTO);
            }

            return Ok(taiKhoanDTOs);
        }

        [HttpPost("dang-ky")]
        [AllowAnonymous]
        public async Task<IActionResult> DangKy([FromBody] DangKyTaiKhoanDTO model)
        {
            try
            {
                if (model == null || string.IsNullOrEmpty(model.TenDangNhap) ||
                    string.IsNullOrEmpty(model.MatKhau) || string.IsNullOrEmpty(model.Email))
                {
                    return BadRequest(new { success = false, message = "Thông tin đăng ký không hợp lệ" });
                }

                if (IsDevelopmentAuthEnabled())
                {
                    if (!IsStrongPassword(model.MatKhau))
                    {
                        return BadRequest(new { success = false, message = "Mật khẩu chưa đủ mạnh. Yêu cầu tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt." });
                    }

                    if (!IsValidEmail(model.Email))
                    {
                        return BadRequest(new { success = false, message = "Email không hợp lệ" });
                    }

                    try
                    {
                        var user = DevelopmentAuthStore.Register(
                            model.TenDangNhap,
                            model.Email,
                            model.MatKhau,
                            TaoTenHienThi(model));

                        return TaoPhanHoiDangNhapDevelopment(user, 201);
                    }
                    catch (InvalidOperationException ex)
                    {
                        return Conflict(new { success = false, message = ex.Message });
                    }
                }

                var recaptchaEnabled = _configuration.GetValue<bool>("RecaptchaSettings:Enabled");
                if (recaptchaEnabled)
                {
                    if (string.IsNullOrEmpty(model.RecaptchaToken))
                    {
                        return BadRequest(new { success = false, message = "Token reCAPTCHA không được để trống" });
                    }

                    bool isRecaptchaValid = await _recaptchaService.VerifyRecaptchaAsync(model.RecaptchaToken);
                    if (!isRecaptchaValid)
                    {
                        _logger.LogWarning($"reCAPTCHA verification failed for registration attempt with username: {model.TenDangNhap}");
                        return BadRequest(new { success = false, message = "Xác thực reCAPTCHA thất bại. Vui lòng thử lại." });
                    }
                }

                if (!IsStrongPassword(model.MatKhau))
                {
                    return BadRequest(new { success = false, message = "Mật khẩu chưa đủ mạnh. Yêu cầu tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt." });
                }

                if (!IsValidEmail(model.Email))
                {
                    return BadRequest(new { success = false, message = "Email không hợp lệ" });
                }

                if (await _context.TaiKhoan.AnyAsync(t => t.TenDangNhap == model.TenDangNhap))
                {
                    return Conflict(new { success = false, message = "Tên đăng nhập đã được sử dụng" });
                }

                if (await _context.TaiKhoan.AnyAsync(t => t.Email == model.Email))
                {
                    return Conflict(new { success = false, message = "Email đã được sử dụng" });
                }

                using (var transaction = await _context.Database.BeginTransactionAsync())
                {
                    try
                    {
                        var taiKhoan = new TaiKhoan
                        {
                            TenDangNhap = model.TenDangNhap,
                            MatKhau = BCrypt.Net.BCrypt.HashPassword(model.MatKhau, 12),
                            Email = model.Email,
                            TrangThai = true,
                            NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                            LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow),
                            TenHienThi = TaoTenHienThi(model),
                            IsMetaMask = false
                        };
                        _context.TaiKhoan.Add(taiKhoan);
                        await _context.SaveChangesAsync();

                        var vaiTroNguoiDung = await GetOrCreateRoleAsync("Nguoi Dung");
                        var taiKhoanVaiTro = new TaiKhoanVaiTroAdmin
                        {
                            TaiKhoanId = taiKhoan.Id,
                            VaiTroId = vaiTroNguoiDung.Id
                        };
                        _context.TaiKhoanVaiTroAdmins.Add(taiKhoanVaiTro);
                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        _logger.LogInformation("Đăng ký tài khoản thành công cho TaiKhoanId: {TaiKhoanId}", taiKhoan.Id);

                        var role = await GetVaiTroNguoiDungAsync(taiKhoan.Id)
                            ?? new VaiTroDTO { TenVaiTro = "Nguoi Dung" };

                        return await TaoPhanHoiDangNhapAsync(taiKhoan, role, new List<ViBlockchain>(), 201);
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError(ex, "Lỗi đăng ký: {Message}", ex.Message);
                        return StatusCode(500, new { success = false, message = "Lỗi khi đăng ký tài khoản" });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi hệ thống: {Message}", ex.Message);
                return StatusCode(500, new { success = false, message = "Lỗi hệ thống, vui lòng thử lại sau" });
            }
        }


        private static readonly HashSet<string> DisposableEmailDomains = new()
        {
            "tempmail.com", "10minutemail.com", "guerrillamail.com", "mailinator.com",
            "yopmail.com", "trashmail.com", "fakeinbox.com", "sharklasers.com",
            "dispostable.com", "getairmail.com", "mintemail.com"
        };

        private bool IsValidEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;

            // Regex kiểm tra email theo chuẩn RFC 5322
            string pattern = @"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$";
            if (!Regex.IsMatch(email, pattern, RegexOptions.IgnoreCase))
            {
                return false;
            }

            // Tách domain từ email
            string domain = email.Split('@').Last().ToLower();

            // Kiểm tra xem domain có nằm trong danh sách email tạm thời không
            if (DisposableEmailDomains.Contains(domain))
            {
                return false;
            }

            return true;
        }

        private async Task<VaiTroDTO?> GetVaiTroNguoiDungAsync(int taiKhoanId)
        {
            return await (from r in _context.Set<VaiTro>()
                          join ur in _context.Set<TaiKhoanVaiTroAdmin>() on r.Id equals ur.VaiTroId
                          where ur.TaiKhoanId == taiKhoanId
                          select new VaiTroDTO { TenVaiTro = r.TenVaiTro }).FirstOrDefaultAsync();
        }

        private async Task<VaiTro> GetOrCreateRoleAsync(string tenVaiTro)
        {
            var vaiTro = await _context.VaiTros.FirstOrDefaultAsync(v => v.TenVaiTro == tenVaiTro);
            if (vaiTro != null)
            {
                return vaiTro;
            }

            vaiTro = new VaiTro
            {
                TenVaiTro = tenVaiTro
            };

            _context.VaiTros.Add(vaiTro);
            await _context.SaveChangesAsync();
            return vaiTro;
        }

        private async Task<List<ViBlockchain>> GetDanhSachViAsync(int taiKhoanId)
        {
            return await _context.ViBlockchain
                .Where(w => w.TaiKhoanId == taiKhoanId && w.TrangThai == true)
                .OrderByDescending(w => w.IsPrimaryWallet)
                .ThenBy(w => w.ViId)
                .ToListAsync();
        }

        private List<Claim> TaoClaimsNguoiDung(TaiKhoan user, VaiTroDTO role, IEnumerable<ViBlockchain> wallets)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.TenDangNhap),
                new Claim("UserID", user.Id.ToString()),
                new Claim(ClaimTypes.Role, role.TenVaiTro)
            };

            foreach (var wallet in wallets)
            {
                claims.Add(new Claim("DiaChiVi", wallet.DiaChiVi));
                claims.Add(new Claim("LoaiVi", wallet.LoaiVi.ToString()));
            }

            return claims;
        }

        private object TaoUserDto(TaiKhoan user, VaiTroDTO role, IReadOnlyCollection<ViBlockchain> wallets)
        {
            var primaryWallet = wallets.FirstOrDefault(w => w.IsPrimaryWallet) ?? wallets.FirstOrDefault();

            return new
            {
                Id = user.Id,
                TenDangNhap = user.TenDangNhap,
                HoTen = (string?)null,
                Email = user.Email,
                TrangThai = user.TrangThai,
                NgayThamGia = user.NgayThamGia?.ToString("yyyy-MM-dd"),
                LanDangNhapCuoi = user.LanDangNhapCuoi?.ToString("yyyy-MM-dd"),
                RefreshToken = (string?)null,
                RefreshTokenExpiryTime = (string?)null,
                VaiTro = new { Id = 0, TenVaiTro = role.TenVaiTro, ChucNangs = (object?)null },
                CuocBauCus = new List<object>(),
                IsMetaMask = user.IsMetaMask,
                TenHienThi = string.IsNullOrWhiteSpace(user.TenHienThi) ? user.TenDangNhap : user.TenHienThi,
                DiaChiVi = primaryWallet?.DiaChiVi
            };
        }

        private async Task<IActionResult> TaoPhanHoiDangNhapAsync(
            TaiKhoan user,
            VaiTroDTO role,
            List<ViBlockchain> wallets,
            int successStatusCode = 200)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var claims = TaoClaimsNguoiDung(user, role, wallets);
                var accessToken = _jwtService.GenerateAccessToken(claims);
                var refreshToken = _jwtService.GenerateRefreshToken();

                user.RefreshToken = _jwtService.EncryptToken(refreshToken);
                user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays);

                var phienDangNhap = new PhienDangNhap
                {
                    TaiKhoanId = user.Id,
                    DuLieuPhien = user.RefreshToken,
                    IP = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                    ThietBi = Request.Headers["User-Agent"].ToString(),
                    NgayHetHan = user.RefreshTokenExpiryTime.Value,
                    IsActive = true
                };

                _context.PhienDangNhaps.Add(phienDangNhap);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = Request.IsHttps,
                    SameSite = Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
                    Expires = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpirationDays)
                });

                return StatusCode(successStatusCode, new
                {
                    Success = true,
                    AccessToken = accessToken,
                    User = TaoUserDto(user, role, wallets),
                    Wallets = wallets.Select(w => new
                    {
                        w.ViId,
                        w.TaiKhoanId,
                        w.DiaChiVi,
                        w.LoaiVi,
                        w.SCWNonce,
                        w.ThoiGianTao,
                        w.TrangThai,
                        w.IsPrimaryWallet
                    }).ToList()
                });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private string TaoTenHienThi(DangKyTaiKhoanDTO model)
        {
            var tenDayDu = string.Join(
                " ",
                new[] { model.Ho?.Trim(), model.Ten?.Trim() }
                    .Where(value => !string.IsNullOrWhiteSpace(value)));

            return string.IsNullOrWhiteSpace(tenDayDu) ? model.TenDangNhap : tenDayDu;
        }


        [HttpPut("{id}")]
        public async Task<IActionResult> PutTaiKhoan(int id, [FromBody] DangKyTaiKhoanDTO model)
        {
            if (id != model.Id)
            {
                return BadRequest("ID không hợp lệ.");
            }
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            var existingTaiKhoan = await _context.TaiKhoan.FindAsync(id);
            if (existingTaiKhoan == null)
            {
                return NotFound("Tài khoản không tồn tại.");
            }

            existingTaiKhoan.TenDangNhap = model.TenDangNhap;
            existingTaiKhoan.Email = model.Email;
            existingTaiKhoan.TrangThai = model.TrangThai;
            existingTaiKhoan.NgayThamGia = model.NgayThamGia;
            existingTaiKhoan.LanDangNhapCuoi = model.LanDangNhapCuoi;

            if (!string.IsNullOrEmpty(model.MatKhau) &&
                model.MatKhau != existingTaiKhoan.MatKhau)
            {
                existingTaiKhoan.MatKhau = BCrypt.Net.BCrypt.HashPassword(model.MatKhau);
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTaiKhoan(int id)
        {
            var taiKhoan = await _context.TaiKhoan.FindAsync(id);
            if (taiKhoan == null)
            {
                return NotFound("Tài khoản không tồn tại.");
            }
            _context.TaiKhoan.Remove(taiKhoan);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("update-password/{id}")]
        public async Task<IActionResult> UpdatePassword(int id, [FromBody] UpdatePasswordDTO model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = await _context.TaiKhoan.FindAsync(id);
            if (user == null)
            {
                return NotFound("Tài khoản không tồn tại.");
            }

            if (!BCrypt.Net.BCrypt.Verify(model.OldPassword, user.MatKhau))
            {
                return Unauthorized("Mật khẩu cũ không đúng.");
            }

            user.MatKhau = BCrypt.Net.BCrypt.HashPassword(model.NewPassword);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPut("reset-password/{id}")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDTO model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var user = await _context.TaiKhoan.FindAsync(id);
            if (user == null)
            {
                return NotFound("Tài khoản không tồn tại.");
            }

            user.MatKhau = BCrypt.Net.BCrypt.HashPassword(model.NewPassword);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("login-metamask")]
        [AllowAnonymous]
        public async Task<IActionResult> LoginWithMetamask([FromBody] WalletLoginDTO model)
        {
            if (string.IsNullOrEmpty(model.DiaChiVi))
            {
                return BadRequest(new { success = false, message = "Địa chỉ ví không được để trống." });
            }
            if (!model.DiaChiVi.StartsWith("0x") || model.DiaChiVi.Length != 42)
            {
                return BadRequest(new { success = false, message = "Địa chỉ ví không đúng định dạng (phải bắt đầu bằng '0x' và dài 42 ký tự)." });
            }
            if (string.IsNullOrEmpty(model.Nonce))
            {
                return BadRequest(new { success = false, message = "Nonce không được để trống." });
            }
            if (string.IsNullOrEmpty(model.Signature))
            {
                return BadRequest(new { success = false, message = "Chữ ký không được để trống." });
            }

            try
            {
                var signer = new EthereumMessageSigner();
                var recoveredAddress = signer.EncodeUTF8AndEcRecover(model.Nonce, model.Signature);
                if (recoveredAddress.ToLower() != model.DiaChiVi.ToLower())
                {
                    return Unauthorized(new { success = false, message = "Chữ ký không khớp với địa chỉ ví cung cấp." });
                }
            }
            catch (FormatException ex)
            {
                return BadRequest(new { success = false, message = $"Lỗi định dạng chữ ký: {ex.Message}. Vui lòng kiểm tra chữ ký từ ví." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xác minh chữ ký: {Message}", ex.Message);
                return StatusCode(500, new { success = false, message = "Lỗi khi xác minh chữ ký, vui lòng thử lại sau." });
            }

            if (IsDevelopmentAuthEnabled())
            {
                var developmentUser = DevelopmentAuthStore.LoginWithMetaMask(model.DiaChiVi);
                return TaoPhanHoiDangNhapDevelopment(developmentUser);
            }

            var wallet = await _context.ViBlockchain
                .FirstOrDefaultAsync(w => w.DiaChiVi.ToLower() == model.DiaChiVi.ToLower());

            TaiKhoan user;

            if (wallet == null)
            {
                try
                {
                    user = new TaiKhoan
                    {
                        TenDangNhap = "Wallet_" + Guid.NewGuid().ToString().Substring(0, 8),
                        Email = $"{model.DiaChiVi.Substring(0, Math.Min(8, model.DiaChiVi.Length))}{Guid.NewGuid().ToString()[..4]}@holihu-wallet.com",
                        TrangThai = true,
                        NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                        LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow),
                        MatKhau = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                        TenHienThi = "User_" + model.DiaChiVi.Substring(2, 6),
                        IsMetaMask = true
                    };
                    _context.TaiKhoan.Add(user);
                    await _context.SaveChangesAsync();

                    var vaiTroNguoiDung = await GetOrCreateRoleAsync("Nguoi Dung");
                    var taiKhoanVaiTroAdmin = new TaiKhoanVaiTroAdmin
                    {
                        TaiKhoanId = user.Id,
                        VaiTroId = vaiTroNguoiDung.Id
                    };
                    _context.TaiKhoanVaiTroAdmins.Add(taiKhoanVaiTroAdmin);

                    var newWallet = new ViBlockchain
                    {
                        TaiKhoanId = user.Id,
                        DiaChiVi = model.DiaChiVi,
                        LoaiVi = 1,
                        SCWNonce = null,
                        ThoiGianTao = DateTime.UtcNow,
                        TrangThai = true,
                        IsPrimaryWallet = true,
                        NguonTao = "metamask_login"
                    };
                    _context.ViBlockchain.Add(newWallet);
                    await _context.SaveChangesAsync();

                    wallet = newWallet;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tạo tài khoản mới: {Message}", ex.Message);
                    return StatusCode(500, new { success = false, message = $"Lỗi khi tạo tài khoản mới: {ex.Message}. Vui lòng thử lại." });
                }
            }
            else
            {
                user = await _context.TaiKhoan
                    .FirstOrDefaultAsync(u => u.Id == wallet.TaiKhoanId);
                if (user == null)
                {
                    return Unauthorized(new { success = false, message = "Tài khoản liên kết với ví không tồn tại trong hệ thống." });
                }
                user.LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow);
                await _context.SaveChangesAsync();
            }

            var role = await GetVaiTroNguoiDungAsync(user.Id);
            if (role == null)
            {
                _logger.LogWarning("Không tìm thấy vai trò cho tài khoản UserID: {UserId}", user.Id);
                return Unauthorized(new { success = false, message = "Không tìm thấy vai trò cho tài khoản này." });
            }

            try
            {
                var wallets = await GetDanhSachViAsync(user.Id);
                _logger.LogInformation("Đăng nhập MetaMask thành công cho UserID: {UserId}, DiaChiVi: {DiaChiVi}", user.Id, model.DiaChiVi);
                return await TaoPhanHoiDangNhapAsync(user, role, wallets);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo token hoặc lưu phiên đăng nhập cho DiaChiVi: {DiaChiVi}: {Message}", model.DiaChiVi, ex.Message);
                return StatusCode(500, new { success = false, message = "Lỗi khi tạo token hoặc lưu phiên đăng nhập, vui lòng thử lại." });
            }
        }

        // Phương thức hỗ trợ tạo SCW (đã loại bỏ CreateSCWForUser cũ)

        private bool IsStrongPassword(string password)
        {
            // Kiểm tra độ dài tối thiểu
            if (string.IsNullOrEmpty(password) || password.Length < 8)
                return false;

            // Kiểm tra có ít nhất 1 chữ hoa
            if (!password.Any(char.IsUpper))
                return false;

            // Kiểm tra có ít nhất 1 chữ thường
            if (!password.Any(char.IsLower))
                return false;

            // Kiểm tra có ít nhất 1 chữ số
            if (!password.Any(char.IsDigit))
                return false;

            // Kiểm tra có ít nhất 1 ký tự đặc biệt
            if (!password.Any(c => !char.IsLetterOrDigit(c)))
                return false;

            // Kiểm tra không có khoảng trắng
            if (password.Contains(" "))
                return false;

            return true;
        }

        // Phương thức tạo SCW cho người dùng
        // Sửa phương thức CreateSCWForUser để trả về địa chỉ SCW thay vì boolean
        //private async Task<string> CreateSCWForUser(int userId, string metamaskAddress)
        //{
        //    try
        //    {
        //        _logger.LogInformation("🔹 Bắt đầu tạo SCW cho UserID: {UserId}, MetaMask: {MetaMaskAddress}", userId, metamaskAddress);

        //        // ✅ 1. Sinh salt
        //        string salt = _cryptoService.GenerateSalt($"user_{userId}_{DateTime.UtcNow.Ticks}");
        //        _logger.LogInformation("✅ Salt được sinh ra: {Salt}", salt);

        //        // ✅ 2. Lấy factory address từ config
        //        string factoryAddress = _configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"] ?? "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0";

        //        // ✅ 3. Dự đoán địa chỉ SCW
        //        string predictedScw = await _blockchainService.PredictSCWAddress(factoryAddress, metamaskAddress, salt);
        //        _logger.LogInformation("✅ Địa chỉ SCW dự đoán: {PredictedScw}", predictedScw);

        //        // ✅ 4. Kiểm tra SCW trong DB trước (tối ưu hơn blockchain)
        //        bool isAlreadyInDB = await _context.ViBlockchain.AnyAsync(w => w.DiaChiVi.ToLower() == predictedScw.ToLower());
        //        if (isAlreadyInDB)
        //        {
        //            _logger.LogWarning("⚠️ SCW đã tồn tại trong DB: {PredictedScw}", predictedScw);
        //            return predictedScw; // Trả về ngay nếu đã có trong DB
        //        }

        //        // ✅ 5. Kiểm tra SCW trên blockchain
        //        if (await _blockchainService.CheckSCWExists(predictedScw))
        //        {
        //            _logger.LogWarning("⚠️ SCW đã tồn tại trên blockchain nhưng chưa có trong DB: {PredictedScw}", predictedScw);
        //            // Lưu vào DB nếu cần (trường hợp hiếm)
        //            await SaveSCWToDB(userId, predictedScw);
        //            return predictedScw;
        //        }

        //        // ✅ 6. Triển khai SCW (tách khỏi transaction)
        //        _logger.LogInformation("🚀 Triển khai SCW cho địa chỉ: {PredictedScw}", predictedScw);
        //        string deployResult = null;
        //        try
        //        {
        //            deployResult = await _blockchainService.DeploySimpleAccount(metamaskAddress, salt);
        //            _logger.LogInformation("✅ Kết quả triển khai SCW: {DeployResult}", deployResult);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "❌ Lỗi khi triển khai SCW cho {PredictedScw}: {Message}", predictedScw, ex.Message);
        //            return null; // Không tiếp tục nếu deploy thất bại
        //        }

        //        // ✅ 7. Kiểm tra lại SCW trên blockchain
        //        if (!await _blockchainService.CheckSCWExists(predictedScw))
        //        {
        //            _logger.LogError("❌ SCW không được triển khai thành công: {PredictedScw}", predictedScw);
        //            return null;
        //        }

        //        // ✅ 8. Lưu SCW vào DB với transaction
        //        await SaveSCWToDB(userId, predictedScw);

        //        // ✅ 9. Kiểm tra và mint token nếu cần
        //        try
        //        {
        //            decimal minRequiredBalance = 10M;
        //            decimal tokenBalance = await _blockchainService.GetTokenBalance(predictedScw);
        //            _logger.LogInformation("💰 Số dư token hiện tại của {PredictedScw}: {Balance}", predictedScw, tokenBalance);

        //            if (tokenBalance < minRequiredBalance)
        //            {
        //                decimal amountToMint = minRequiredBalance - tokenBalance;
        //                _logger.LogInformation("🔹 Cấp {Amount} token cho {PredictedScw}", amountToMint, predictedScw);
        //                await _blockchainService.MintInitialTokens(predictedScw, amountToMint.ToString());
        //                _logger.LogInformation("✅ Đã mint {Amount} token thành công cho {PredictedScw}", amountToMint, predictedScw);
        //            }
        //            else
        //            {
        //                _logger.LogInformation("✅ Không cần mint token vì số dư đã đủ");
        //            }
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogWarning(ex, "⚠️ Lỗi khi mint token cho SCW {ScwAddress}: {Message}", predictedScw, ex.Message);
        //        }

        //        return predictedScw;
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "❌ Lỗi hệ thống khi tạo SCW cho UserID {UserId}: {Message}", userId, ex.Message);
        //        return null;
        //    }
        //}

        /// <summary>
        /// Lưu SCW vào DB với transaction riêng
        /// </summary>
        private async Task SaveSCWToDB(int userId, string predictedScw)
        {
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    var viScw = new ViBlockchain
                    {
                        TaiKhoanId = userId,
                        DiaChiVi = predictedScw,
                        LoaiVi = 2, // 2 = SCW
                        SCWNonce = 0,
                        ThoiGianTao = DateTime.UtcNow,
                        TrangThai = true,
                        IsPrimaryWallet = false,
                        NguonTao = "login"
                    };
                    _context.ViBlockchain.Add(viScw);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    _logger.LogInformation("✅ Đã lưu SCW vào DB cho UserID: {UserId}, DiaChiVi: {PredictedScw}", userId, predictedScw);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "❌ Lỗi khi lưu SCW vào DB cho UserID {UserId}: {Message}", userId, ex.Message);
                    throw; // Ném lỗi để caller xử lý
                }
            }
        }
    }
}
