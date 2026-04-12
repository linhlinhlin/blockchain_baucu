using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PhienDangNhapController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly JwtService _jwtService;

        public PhienDangNhapController(ApplicationDbContext context, JwtService jwtService)
        {
            _context = context;
            _jwtService = jwtService;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateSession([FromBody] TaoPhienDangNhapDTO dto)
        {
            if (dto == null)
            {
                return BadRequest("Invalid data.");
            }

            // Giới hạn số lượng phiên đăng nhập
            var activeSessions = await _context.PhienDangNhaps
                .Where(s => s.TaiKhoanId == dto.TaiKhoanID && s.IsActive)
                .ToListAsync();

            if (activeSessions.Count >= 3)
            {
                var oldestSession = activeSessions.OrderBy(s => s.NgayTao).First();
                _context.PhienDangNhaps.Remove(oldestSession); // Xóa khỏi database
                await _context.SaveChangesAsync();
            }

            var session = new PhienDangNhap
            {
                TaiKhoanId = dto.TaiKhoanID,
                DuLieuPhien = dto.DuLieuPhien,
                IP = dto.IP,
                ThietBi = dto.ThietBi,
                TrinhDuyet = dto.TrinhDuyet,
                NgayHetHan = dto.NgayHetHan,
                IsActive = true
            };

            _context.PhienDangNhaps.Add(session);
            await _context.SaveChangesAsync();

            return Ok(session);
        }

        [HttpGet("check")]
        public async Task<IActionResult> CheckSession()
        {
            var token = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
            var isValidJwt = _jwtService.ValidateToken(token);
            if (!isValidJwt)
            {
                return Unauthorized("Token không hợp lệ hoặc đã bị chỉnh sửa.");
            }

            var session = await _context.PhienDangNhaps.FirstOrDefaultAsync(s => s.DuLieuPhien == token && s.IsActive);

            if (session == null || session.NgayHetHan <= DateTime.UtcNow)
            {
                await _context.LichSuHoatDongs.AddAsync(new LichSuHoatDong
                {
                    TaiKhoanId = session?.TaiKhoanId ?? 0,
                    HoatDong = "Token bị từ chối",
                    ThoiGian = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return Ok(new { valid = false, message = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
            }

            return Ok(new { valid = true, message = "Phiên đăng nhập hợp lệ.", taiKhoanID = session.TaiKhoanId, isActive = session.IsActive });
        }

        [HttpDelete("logout/{id}")]
        public async Task<IActionResult> LogoutSession(int id)
        {
            var session = await _context.PhienDangNhaps.FindAsync(id);

            if (session == null)
            {
                return NotFound("Không tìm thấy phiên đăng nhập.");
            }

            session.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Phiên đăng nhập đã được đăng xuất thành công." });
        }

        [HttpGet("user/{taiKhoanID}")]
        public async Task<IActionResult> GetUserSessions(int taiKhoanID)
        {
            var sessions = await _context.PhienDangNhaps
                .Where(s => s.TaiKhoanId == taiKhoanID)
                .Select(s => new
                {
                    s.Id,
                    s.TaiKhoanId,
                    s.IP,
                    s.ThietBi,
                    s.TrinhDuyet,
                    s.NgayTao,
                    s.NgayHetHan,
                    s.IsActive
                })
                .ToListAsync();

            return Ok(sessions);
        }

        [HttpDelete("logoutAll/{taiKhoanID}")]
        public async Task<IActionResult> LogoutAllSessions(int taiKhoanID)
        {
            var sessions = await _context.PhienDangNhaps.Where(s => s.TaiKhoanId == taiKhoanID).ToListAsync();

            foreach (var session in sessions)
            {
                session.IsActive = false;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Tất cả phiên đăng nhập của người dùng đã bị xóa." });
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
                await _context.RevokedTokens.AddAsync(new RevokedToken
                {
                    Token = model.RefreshToken,
                    RevokedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return NotFound();
            }

            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            await _context.SaveChangesAsync();

            var phienDangNhap = await _context.PhienDangNhaps
                .FirstOrDefaultAsync(p => p.TaiKhoanId == user.Id && p.DuLieuPhien == model.RefreshToken);
            if (phienDangNhap != null)
            {
                _context.PhienDangNhaps.Remove(phienDangNhap);
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        [HttpGet("active-sessions/{userId}")]
        [Authorize]
        public async Task<IActionResult> GetActiveSessions(int userId)
        {
            var activeSessions = await _context.PhienDangNhaps
                .Where(p => p.TaiKhoanId == userId && p.IsActive)
                .ToListAsync();

            return Ok(activeSessions);
        }

        // Thêm phương thức mới để lấy phiên đăng nhập gần nhất
        [HttpGet("latest-session/{taiKhoanID}")]
        public async Task<IActionResult> GetLatestSession(int taiKhoanID)
        {
            var latestSession = await _context.PhienDangNhaps
                .Where(s => s.TaiKhoanId == taiKhoanID)
                .OrderByDescending(s => s.NgayTao)
                .FirstOrDefaultAsync();

            if (latestSession == null)
            {
                return NotFound("Không tìm thấy phiên đăng nhập.");
            }

            return Ok(latestSession);
        }
    }
}

