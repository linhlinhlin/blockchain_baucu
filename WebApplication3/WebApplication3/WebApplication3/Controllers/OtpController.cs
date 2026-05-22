using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OtpController : ControllerBase
    {
        private static Dictionary<string, OtpModel> _otpStorage = new Dictionary<string, OtpModel>();
        private static Dictionary<string, VerificationModel> _verificationStorage = new Dictionary<string, VerificationModel>();
        private readonly IConfiguration _configuration;
        private readonly EmailService _emailService;
        private readonly RazorViewToStringRenderer _razorViewToStringRenderer;
        private readonly ApplicationDbContext _context;

        public OtpController(
            IConfiguration configuration,
            EmailService emailService,
            RazorViewToStringRenderer razorViewToStringRenderer,
            ApplicationDbContext context)
        {
            _configuration = configuration;
            _emailService = emailService;
            _razorViewToStringRenderer = razorViewToStringRenderer;
            _context = context;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendOtp([FromBody] string email)
        {
            var otp = GenerateOtp();
            var expiryTime = DateTime.Now.AddMinutes(15);

            var otpModel = new OtpModel
            {
                Email = email,
                Otp = otp,
                ExpiryTime = expiryTime
            };

            _otpStorage[email] = otpModel;

            // Set ViewData for email content
            var viewData = new ViewDataDictionary(new EmptyModelMetadataProvider(), new ModelStateDictionary())
            {
                ["EmailTitle"] = "Mã OTP từ HoLiHu",
                ["Heading"] = "Xác minh tài khoản của bạn",
                ["Greeting"] = "Thân gửi",
                ["Intro"] = "Cảm ơn bạn đã sử dụng dịch vụ của HoLiHu. Để hoàn tất quá trình xác minh, vui lòng sử dụng mã OTP sau:",
                ["Expiry"] = "Mã OTP này sẽ hết hạn sau <strong>15 phút</strong>.",
                ["Warning"] = "Vì lý do bảo mật, xin vui lòng không chia sẻ mã này với bất kỳ ai, bao gồm cả nhân viên của HoLiHu.",
                ["IgnoreMessage"] = "Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email và liên hệ ngay với đội ngũ hỗ trợ của chúng tôi.",
                ["Closing"] = "Trân trọng,",
                ["Team"] = "Đội ngũ HoLiHu",
                ["Rights"] = "Bản quyền thuộc về HoLiHu. Mọi quyền được bảo lưu.",
                ["Privacy"] = "Chính sách bảo mật",
                ["Terms"] = "Điều khoản dịch vụ",
                ["AutomatedMessage"] = "Đây là email tự động, vui lòng không trả lời thư này.",
                ["SupportMessage"] = "Nếu cần hỗ trợ, vui lòng liên hệ với đội ngũ chăm sóc khách hàng của chúng tôi."
            };

            // Render Razor view to string with ViewData
            var emailContent = await _razorViewToStringRenderer.RenderViewToStringAsync("/Views/Email/EmailHTML.cshtml", otpModel, viewData);

            // Ensure EmailTitle is not null before sending email
            var emailTitle = viewData["EmailTitle"]?.ToString() ?? "Your OTP Code from HoLiHu";

            // Send OTP via email
            await _emailService.SendEmailAsync(email, emailTitle, emailContent);

            return Ok(new { success = true, message = "OTP được gửi thành công" });
        }

        [HttpPost("verify")]
        public IActionResult VerifyOtp([FromBody] VerifyOtpRequest request)
        {
            if (string.IsNullOrEmpty(request.Email))
            {
                return BadRequest(new { success = false, message = "Email không được để trống." });
            }

            if (_otpStorage.TryGetValue(request.Email, out var otpModel))
            {
                if (otpModel.Otp == request.Otp && otpModel.ExpiryTime > DateTime.Now)
                {
                    _otpStorage.Remove(request.Email);
                    return Ok(new { success = true, message = "Xác thực OTP thành công." });
                }
                else
                {
                    return BadRequest(new { success = false, message = "OTP không hợp lệ hoặc đã hết hạn." });
                }
            }

            return BadRequest(new { success = false, message = "Không tìm thấy OTP cho email này." });
        }

        // API mới để gửi email xác thực cử tri
        [HttpPost("send-verification")]
        public async Task<IActionResult> SendVoterVerification([FromBody] VoterVerificationRequest request)
        {
            if (string.IsNullOrEmpty(request.Email))
            {
                return BadRequest(new { success = false, message = "Email không được để trống." });
            }

            var token = GenerateVerificationToken();
            var expiryTime = DateTime.Now.AddDays(3);

            // Lưu token vào bảng tạm thời
            _verificationStorage[request.Email] = new VerificationModel
            {
                Email = request.Email,
                Token = token,
                PhienBauCuId = request.PhienBauCuId,
                CuocBauCuId = request.CuocBauCuId,
                ExpiryTime = expiryTime
            };

            // URL web xác thực
            var appUrl = _configuration["AppUrl"] ?? "https://holihu.online";
            var verificationUrl = $"{appUrl}/verify-voter?token={token}";

            // Thiết lập dữ liệu cho email
            var viewData = new ViewDataDictionary(new EmptyModelMetadataProvider(), new ModelStateDictionary())
            {
                ["EmailTitle"] = "Xác thực cử tri cho phiên bầu cử",
                ["Heading"] = "Xác thực tài khoản cử tri",
                ["Greeting"] = "Thân gửi",
                ["Intro"] = "Bạn đã được thêm làm cử tri trong phiên bầu cử. Để hoàn tất quá trình xác thực, vui lòng nhấp vào nút bên dưới:",
                ["ButtonText"] = "Xác thực tài khoản",
                ["ButtonUrl"] = verificationUrl,
                ["WalletMsg"] = "Lưu ý: Để tham gia bỏ phiếu, bạn cần có tài khoản và ví blockchain được liên kết. Nếu chưa có, hệ thống sẽ hướng dẫn bạn sau khi xác thực email.",
                ["ExpiryNotice"] = "Liên kết này sẽ hết hạn sau 3 ngày.",
                ["Warning"] = "Vì lý do bảo mật, xin vui lòng không chia sẻ liên kết này với bất kỳ ai.",
                ["IgnoreMessage"] = "Nếu bạn không tham gia phiên bầu cử này, vui lòng bỏ qua email và liên hệ ngay với đội ngũ hỗ trợ của chúng tôi.",
                ["Closing"] = "Trân trọng,",
                ["Team"] = "Đội ngũ HoLiHu",
                ["Rights"] = "Bản quyền thuộc về HoLiHu. Mọi quyền được bảo lưu.",
                ["Privacy"] = "Chính sách bảo mật",
                ["Terms"] = "Điều khoản dịch vụ",
                ["AutomatedMessage"] = "Đây là email tự động, vui lòng không trả lời thư này.",
                ["SupportMessage"] = "Nếu cần hỗ trợ, vui lòng liên hệ với đội ngũ chăm sóc khách hàng của chúng tôi."
            };

            // Tạo model cho email
            var otpModel = new OtpModel
            {
                Email = request.Email,
                Otp = "VERIFY", // Không sử dụng OTP nhưng cần model này cho template
                ExpiryTime = expiryTime
            };

            // Render và gửi email 
            var emailContent = await _razorViewToStringRenderer.RenderViewToStringAsync("/Views/Email/VoterVerificationEmail.cshtml", otpModel, viewData);
            var emailTitle = viewData["EmailTitle"]?.ToString() ?? "Xác thực cử tri cho phiên bầu cử";
            await _emailService.SendEmailAsync(request.Email, emailTitle, emailContent);

            return Ok(new
            {
                success = true,
                message = "Email xác thực đã được gửi thành công."
            });
        }

        [HttpGet("verify-token")]
        public async Task<IActionResult> VerifyToken([FromQuery] string token)
        {
            var verification = _verificationStorage.Values.FirstOrDefault(v => v.Token == token);

            if (verification == null || verification.ExpiryTime < DateTime.Now)
            {
                return BadRequest(new { success = false, message = "Token không hợp lệ hoặc đã hết hạn." });
            }

            // Tìm cử tri trong hệ thống
            var cuTri = await _context.CuTris.FirstOrDefaultAsync(c =>
                c.Email == verification.Email &&
                c.PhienBauCuId == verification.PhienBauCuId);

            if (cuTri == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy thông tin cử tri." });
            }

            // Kiểm tra xem có tài khoản và ví blockchain không
            var taiKhoan = await _context.TaiKhoan.FirstOrDefaultAsync(t => t.Email == verification.Email);

            if (taiKhoan != null)
            {
                var viBlockchain = await _context.ViBlockchain.FirstOrDefaultAsync(
                    v => v.TaiKhoanId == taiKhoan.Id && v.TrangThai == true);

                if (viBlockchain != null)
                {
                    // Cập nhật trạng thái xác thực của cử tri
                    cuTri.XacMinh = true;
                    cuTri.TaiKhoanId = taiKhoan.Id;
                    _context.Entry(cuTri).State = EntityState.Modified;
                    await _context.SaveChangesAsync();

                    // Xóa token đã sử dụng
                    _verificationStorage.Remove(verification.Email);

                    return Ok(new
                    {
                        success = true,
                        message = "Xác thực cử tri thành công! Bạn đã có thể tham gia bỏ phiếu.",
                        hasAccount = true,
                        hasWallet = true
                    });
                }
                else
                {
                    // Có tài khoản nhưng chưa có ví
                    return Ok(new
                    {
                        success = true,
                        message = "Email đã được xác thực, nhưng bạn cần liên kết ví blockchain để tham gia bỏ phiếu.",
                        hasAccount = true,
                        hasWallet = false,
                        accountId = taiKhoan.Id
                    });
                }
            }
            else
            {
                // Chưa có tài khoản
                return Ok(new
                {
                    success = true,
                    message = "Email đã được xác thực, nhưng bạn cần tạo tài khoản và liên kết ví blockchain để tham gia bỏ phiếu.",
                    hasAccount = false,
                    hasWallet = false
                });
            }
        }

        [HttpPost("contact")]
        public async Task<IActionResult> SendContactEmail([FromBody] ContactRequest request)
        {
            // Kiểm tra các trường bắt buộc
            if (string.IsNullOrEmpty(request.Ten) || request.Tuoi == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.LyDo))
            {
                return BadRequest(new { success = false, message = "Vui lòng điền đầy đủ các thông tin bắt buộc (Tên, Tuổi, Email, Lý do liên hệ)." });
            }

            // Kiểm tra tuổi hợp lệ (từ 18 đến 120)
            if (request.Tuoi < 18 || request.Tuoi > 120)
            {
                return BadRequest(new { success = false, message = "Tuổi phải nằm trong khoảng từ 18 đến 120." });
            }

            // Kiểm tra định dạng email
            if (!Regex.IsMatch(request.Email, @"\S+@\S+\.\S+"))
            {
                return BadRequest(new { success = false, message = "Địa chỉ email không hợp lệ." });
            }

            // Chuyển đổi lý do liên hệ sang tiếng Việt
            var lyDoText = request.LyDo switch
            {
                "Support" => "Hỗ trợ kỹ thuật",
                "Feedback" => "Phản hồi và góp ý",
                "Partnership" => "Hợp tác kinh doanh",
                "Other" => "Lý do khác",
                _ => request.LyDo
            };

            // 1. Gửi email đến đội ngũ hỗ trợ
            var supportViewData = new ViewDataDictionary(new EmptyModelMetadataProvider(), new ModelStateDictionary())
            {
                ["EmailTitle"] = $"Yêu cầu liên hệ mới từ khách hàng – {request.Email}",
                ["LyDo"] = lyDoText
            };
            var supportEmailContent = await _razorViewToStringRenderer.RenderViewToStringAsync("/Views/Email/ContactEmail.cshtml", request, supportViewData);
            var supportEmailTitle = supportViewData["EmailTitle"]?.ToString() ?? "Yêu cầu liên hệ mới từ khách hàng";
            await _emailService.SendEmailAsync("hungkhp888@gmail.com", supportEmailTitle, supportEmailContent);

            // 2. Gửi email xác nhận đến người dùng
            var userViewData = new ViewDataDictionary(new EmptyModelMetadataProvider(), new ModelStateDictionary())
            {
                ["EmailTitle"] = $"Xác nhận yêu cầu hỗ trợ của bạn – {request.Ten}",
                ["Ten"] = request.Ten,
                ["NgayGui"] = DateTime.Now.ToString("dd/MM/yyyy"),
                ["LyDo"] = lyDoText
            };
            var userEmailContent = await _razorViewToStringRenderer.RenderViewToStringAsync("/Views/Email/ConfirmationEmail.cshtml", request, userViewData);
            var userEmailTitle = userViewData["EmailTitle"]?.ToString() ?? "Xác nhận yêu cầu hỗ trợ của bạn";
            await _emailService.SendEmailAsync(request.Email, userEmailTitle, userEmailContent);

            return Ok(new { success = true, message = "Yêu cầu liên hệ đã được gửi thành công và email xác nhận đã được gửi đến bạn." });
        }

        [HttpPost("subscribe")]
        public async Task<IActionResult> SubscribeToUpdates([FromBody] SubscribeRequest request)
        {
            // Kiểm tra email hợp lệ
            if (string.IsNullOrEmpty(request.Email))
            {
                return BadRequest(new { success = false, message = "Email không được để trống." });
            }

            if (!Regex.IsMatch(request.Email, @"\S+@\S+\.\S+"))
            {
                return BadRequest(new { success = false, message = "Địa chỉ email không hợp lệ." });
            }

            // TODO: Lưu email vào database (giả sử tạm thời chưa có DB)
            // Ví dụ: await _subscriptionService.SaveEmail(request.Email);

            // Gửi email chào mừng
            var viewData = new ViewDataDictionary(new EmptyModelMetadataProvider(), new ModelStateDictionary())
            {
                ["EmailTitle"] = "Chào mừng bạn đến với Bầu cử Blockchain Holihu",
                ["Email"] = request.Email,
                ["NgayDangKy"] = DateTime.Now.ToString("dd/MM/yyyy")
            };

            var emailContent = await _razorViewToStringRenderer.RenderViewToStringAsync("/Views/Email/WelcomeEmail.cshtml", request, viewData);
            var emailTitle = viewData["EmailTitle"]?.ToString() ?? "Chào mừng bạn đến với Bầu cử Blockchain Holihu";
            await _emailService.SendEmailAsync(request.Email, emailTitle, emailContent);

            return Ok(new { success = true, message = "Đăng ký thành công! Vui lòng kiểm tra email để xem thông tin chào mừng." });
        }

        private string GenerateOtp()
        {
            return RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        }

        private string GenerateVerificationToken()
        {
            var tokenData = RandomNumberGenerator.GetBytes(32); // 32 bytes = 256 bits
            return Convert.ToBase64String(tokenData)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
        }
    }

    public class VerifyOtpRequest
    {
        public string? Email { get; set; }
        public string? Otp { get; set; }
    }

    public class SubscribeRequest
    {
        public string? Email { get; set; }
    }

    public class ContactRequest
    {
        [JsonPropertyName("ten")]
        public string? Ten { get; set; }
        [JsonPropertyName("tuoi")]
        public int? Tuoi { get; set; }
        [JsonPropertyName("email")]
        public string? Email { get; set; }
        [JsonPropertyName("lyDo")]
        public string? LyDo { get; set; }
        [JsonPropertyName("ghiChu")]
        public string? GhiChu { get; set; }
    }
}
