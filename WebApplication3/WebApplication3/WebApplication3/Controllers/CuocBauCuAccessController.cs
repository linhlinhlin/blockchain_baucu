using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using System.Security.Claims;

namespace WebApplication3.Controllers
{
    [Route("api/CuocBauCu/access")]
    [ApiController]
    [Authorize]
    public class CuocBauCuAccessController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CuocBauCuAccessController> _logger;

        public CuocBauCuAccessController(
            ApplicationDbContext context,
            ILogger<CuocBauCuAccessController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Kiểm tra quyền truy cập vào một cuộc bầu cử
        /// </summary>
        /// <param name="electionId">ID của cuộc bầu cử</param>
        /// <returns>Thông tin về quyền truy cập</returns>
        [HttpGet("election/{electionId}")]
        public async Task<IActionResult> CheckElectionAccess(int electionId)
        {
            try
            {
                // Lấy ID người dùng từ token
                var userIdClaim = User.FindFirst("UserID");
                if (userIdClaim == null)
                {
                    _logger.LogWarning("Không tìm thấy UserID trong token");
                    return Unauthorized(new { hasAccess = false, message = "UserID không tồn tại trong token" });
                }

                int userId = int.Parse(userIdClaim.Value);

                // Kiểm tra vai trò của người dùng
                var roleClaim = User.FindFirst(ClaimTypes.Role);
                if (roleClaim != null && roleClaim.Value == "Quan Tri Vien")
                {
                    // Quản trị viên có quyền truy cập tất cả cuộc bầu cử
                    _logger.LogInformation("Người dùng {UserId} là Quan Tri Vien, có quyền truy cập cuộc bầu cử {ElectionId}", userId, electionId);
                    return Ok(new { hasAccess = true });
                }

                // Kiểm tra xem cuộc bầu cử có tồn tại không
                var cuocBauCu = await _context.CuocBauCus
                    .FirstOrDefaultAsync(c => c.Id == electionId);

                if (cuocBauCu == null)
                {
                    _logger.LogWarning("Không tìm thấy cuộc bầu cử ID {ElectionId}", electionId);
                    return NotFound(new { hasAccess = false, message = "Không tìm thấy cuộc bầu cử" });
                }

                // Kiểm tra xem người dùng có phải là người tạo cuộc bầu cử không
                bool isCreator = cuocBauCu.TaiKhoanId == userId;
                bool hasAccess = isCreator;

                if (hasAccess)
                {
                    _logger.LogInformation("Người dùng {UserId} có quyền truy cập cuộc bầu cử {ElectionId} (Người tạo)", userId, electionId);
                }
                else
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền truy cập cuộc bầu cử {ElectionId}", userId, electionId);
                }

                return Ok(new { hasAccess });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra quyền truy cập cuộc bầu cử ID {ElectionId}", electionId);
                return StatusCode(500, new { hasAccess = false, message = $"Lỗi: {ex.Message}" });
            }
        }

        /// <summary>
        /// Kiểm tra quyền truy cập vào một phiên bầu cử
        /// </summary>
        /// <param name="electionId">ID của cuộc bầu cử</param>
        /// <param name="sessionId">ID của phiên bầu cử</param>
        /// <returns>Thông tin về quyền truy cập</returns>
        [HttpGet("session/{electionId}/{sessionId}")]
        public async Task<IActionResult> CheckSessionAccess(int electionId, int sessionId)
        {
            try
            {
                // Lấy ID người dùng từ token
                var userIdClaim = User.FindFirst("UserID");
                if (userIdClaim == null)
                {
                    _logger.LogWarning("Không tìm thấy UserID trong token");
                    return Unauthorized(new { hasAccess = false, message = "UserID không tồn tại trong token" });
                }

                int userId = int.Parse(userIdClaim.Value);

                // Kiểm tra vai trò của người dùng
                var roleClaim = User.FindFirst(ClaimTypes.Role);
                if (roleClaim != null && roleClaim.Value == "Quan Tri Vien")
                {
                    // Quản trị viên có quyền truy cập tất cả phiên bầu cử
                    _logger.LogInformation("Người dùng {UserId} là Quan Tri Vien, có quyền truy cập phiên bầu cử {SessionId}", userId, sessionId);
                    return Ok(new { hasAccess = true });
                }

                // Kiểm tra xem phiên bầu cử có tồn tại và thuộc cuộc bầu cử đã chỉ định không
                var phienBauCu = await _context.PhienBauCus
                    .FirstOrDefaultAsync(p => p.Id == sessionId && p.CuocBauCuId == electionId);

                if (phienBauCu == null)
                {
                    _logger.LogWarning("Không tìm thấy phiên bầu cử ID {SessionId} thuộc cuộc bầu cử ID {ElectionId}", sessionId, electionId);
                    return NotFound(new { hasAccess = false, message = "Không tìm thấy phiên bầu cử hoặc phiên bầu cử không thuộc cuộc bầu cử này" });
                }

                // Lấy thông tin cuộc bầu cử
                var cuocBauCu = await _context.CuocBauCus
                    .FirstOrDefaultAsync(c => c.Id == electionId);

                if (cuocBauCu == null)
                {
                    _logger.LogWarning("Không tìm thấy cuộc bầu cử ID {ElectionId}", electionId);
                    return NotFound(new { hasAccess = false, message = "Không tìm thấy cuộc bầu cử" });
                }

                // Kiểm tra xem người dùng có phải là người tạo cuộc bầu cử không
                bool isCreator = cuocBauCu.TaiKhoanId == userId;
                bool hasAccess = isCreator;

                if (hasAccess)
                {
                    _logger.LogInformation("Người dùng {UserId} có quyền truy cập phiên bầu cử {SessionId} (Người tạo cuộc bầu cử)", userId, sessionId);
                }
                else
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền truy cập phiên bầu cử {SessionId}", userId, sessionId);
                }

                return Ok(new { hasAccess });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra quyền truy cập phiên bầu cử ID {SessionId} của cuộc bầu cử ID {ElectionId}", sessionId, electionId);
                return StatusCode(500, new { hasAccess = false, message = $"Lỗi: {ex.Message}" });
            }
        }

        /// <summary>
        /// Mở rộng tương lai: Kiểm tra quyền truy cập cho nhiều cuộc bầu cử cùng lúc
        /// </summary>
        [HttpPost("batch-check")]
        public async Task<IActionResult> BatchCheckAccess([FromBody] BatchCheckRequest request)
        {
            if (request == null || request.ElectionIds == null || request.ElectionIds.Length == 0)
            {
                return BadRequest(new { message = "Yêu cầu không hợp lệ. Cần cung cấp ít nhất một ID cuộc bầu cử." });
            }

            try
            {
                // Lấy ID người dùng từ token
                var userIdClaim = User.FindFirst("UserID");
                if (userIdClaim == null)
                {
                    return Unauthorized(new { message = "Không tìm thấy ID người dùng trong token" });
                }

                int userId = int.Parse(userIdClaim.Value);

                // Kiểm tra vai trò của người dùng
                bool isAdmin = User.IsInRole("Quan Tri Vien");

                // Nếu là admin, có quyền truy cập tất cả
                if (isAdmin)
                {
                    var results = request.ElectionIds.ToDictionary(
                        id => id.ToString(),
                        id => true
                    );

                    return Ok(new { results });
                }

                // Lấy tất cả cuộc bầu cử của người dùng hiện tại
                var userElections = await _context.CuocBauCus
                    .Where(c => c.TaiKhoanId == userId)
                    .Select(c => c.Id)
                    .ToListAsync();

                // Xây dựng kết quả
                var accessResults = request.ElectionIds.ToDictionary(
                    id => id.ToString(),
                    id => userElections.Contains(id)
                );

                return Ok(new { results = accessResults });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra quyền hàng loạt");
                return StatusCode(500, new { message = $"Lỗi: {ex.Message}" });
            }
        }
    }

    /// <summary>
    /// Yêu cầu kiểm tra quyền hàng loạt
    /// </summary>
    public class BatchCheckRequest
    {
        public int[] ElectionIds { get; set; }
    }
}