using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using WebApplication3.Data;
using WebApplication3.DTOs;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PhieuMoiPhienBauCuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PhieuMoiPhienBauCuController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public ActionResult<IEnumerable<PhieuMoiPhienBauCuDTO>> GetAll()
        {
            var phieuMoiPhienBauCus = _context.PhieuMoiPhienBauCus
                .Select(p => new PhieuMoiPhienBauCuDTO
                {
                    Id = p.Id,
                    PhienBauCuId = p.PhienBauCuId,
                    NguoiTaoId = p.NguoiTaoId,
                    NgayTao = p.NgayTao,
                    HieuLuc = p.HieuLuc
                })
                .ToList();

            return Ok(phieuMoiPhienBauCus);
        }

        [HttpGet("{id}")]
        public ActionResult<PhieuMoiPhienBauCuDTO> GetById(int id)
        {
            var phieuMoiPhienBauCu = _context.PhieuMoiPhienBauCus
                .Where(p => p.Id == id)
                .Select(p => new PhieuMoiPhienBauCuDTO
                {
                    Id = p.Id,
                    PhienBauCuId = p.PhienBauCuId,
                    NguoiTaoId = p.NguoiTaoId,
                    NgayTao = p.NgayTao,
                    HieuLuc = p.HieuLuc
                })
                .FirstOrDefault();

            if (phieuMoiPhienBauCu == null)
            {
                return NotFound();
            }

            return Ok(phieuMoiPhienBauCu);
        }

        [HttpPost("create")]
        public IActionResult CreateInvite([FromBody] GenerateInviteDTO dto)
        {
            if (dto == null)
            {
                return BadRequest("Invalid data.");
            }

            // Kiểm tra xem NguoiTaoId có tồn tại trong bảng TaiKhoan hay không
            var nguoiTao = _context.TaiKhoan.Find(dto.NguoiTaoId);
            if (nguoiTao == null)
            {
                return BadRequest("NguoiTaoId không tồn tại.");
            }

            // Kiểm tra xem PhienBauCuId có tồn tại trong bảng PhienBauCu hay không
            var phienBauCu = _context.PhienBauCus.Find(dto.PhienBauCuId);
            if (phienBauCu == null)
            {
                return BadRequest("PhienBauCuId không tồn tại.");
            }
            var cuocBauCu = _context.CuocBauCus.Find(dto.CuocBauCuId);
            if (cuocBauCu == null)
            {
                return BadRequest("CuocBauCuId không tồn tại.");
            }

            var invite = new PhieuMoiPhienBauCu
            {
                Token = Guid.NewGuid().ToString(),
                PhienBauCuId = dto.PhienBauCuId,
                CuocBauCuId = dto.CuocBauCuId,
                NguoiTaoId = dto.NguoiTaoId,
                NgayTao = DateTime.UtcNow.ToLocalTime(),
                NgayHetHan = DateTime.UtcNow.AddMinutes(15),
                HieuLuc = true
            };

            _context.PhieuMoiPhienBauCus.Add(invite);
            _context.SaveChanges();

            // Tạo đường link mời hoàn chỉnh
            string inviteUrl = $"https://localhost:3000/invite?token={invite.Token}";

            return Ok(new { inviteUrl, invite.NgayHetHan });
        }

        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] PhieuMoiPhienBauCuDTO dto)
        {
            if (dto == null)
            {
                return BadRequest("Invalid data.");
            }

            var phieuMoiPhienBauCu = _context.PhieuMoiPhienBauCus.Find(id);

            if (phieuMoiPhienBauCu == null)
            {
                return NotFound();
            }

            phieuMoiPhienBauCu.PhienBauCuId = dto.PhienBauCuId;
            phieuMoiPhienBauCu.NguoiTaoId = dto.NguoiTaoId;
            phieuMoiPhienBauCu.NgayTao = dto.NgayTao;
            phieuMoiPhienBauCu.HieuLuc = dto.HieuLuc;

            _context.SaveChanges();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            var phieuMoiPhienBauCu = _context.PhieuMoiPhienBauCus.Find(id);

            if (phieuMoiPhienBauCu == null)
            {
                return NotFound();
            }

            _context.PhieuMoiPhienBauCus.Remove(phieuMoiPhienBauCu);
            _context.SaveChanges();

            return NoContent();
        }

        [HttpPost("validate")]
        [Authorize]
        public IActionResult ValidateInvite([FromBody] ValidatePhienBauCuDTO dto)
        {
            if (string.IsNullOrEmpty(dto.Token))
                return BadRequest("Token không hợp lệ.");

            var invite = _context.PhieuMoiPhienBauCus.FirstOrDefault(i => i.Token == dto.Token);

            if (invite == null || !invite.HieuLuc)
                return NotFound("Lời mời không tồn tại hoặc đã bị thu hồi.");

            if (invite.NgayHetHan <= DateTime.UtcNow)
            {
                invite.HieuLuc = false;
                _context.SaveChanges();
                return BadRequest(new
                {
                    message = "Lời mời đã hết hạn.",
                    expiredAt = invite.NgayHetHan
                });
            }

            if (User.Identity == null || !User.Identity.IsAuthenticated)
                return Unauthorized("Bạn cần đăng nhập để tiếp tục.");

            var userIdClaim = User.FindFirst("UserID"); // ✅ Lấy từ đúng tên Claim trong JWT
            if (userIdClaim == null)
                return Unauthorized("JWT không chứa UserID.");

            if (!int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized($"Lỗi khi parse UserID: {userIdClaim.Value}");

            // Kiểm tra xem user đã tham gia phiên bầu cử chưa
            bool daThamGia = _context.CuTris.Any(c => c.TaiKhoanId == userId && c.PhienBauCuId == invite.PhienBauCuId);
            if (daThamGia)
                return Conflict("Bạn đã tham gia phiên bầu cử này.");

            return Ok(new { valid = true, invite.PhienBauCuId, invite.CuocBauCuId });
        }

        [HttpPost("revoke/{token}")]
        [Authorize]
        public IActionResult RevokeInvite(string token)
        {
            if (User.Identity == null || !User.Identity.IsAuthenticated)
                return Unauthorized("Bạn cần đăng nhập để thực hiện hành động này.");

            var userIdClaim = User.FindFirst("UserID"); // ✅ Lấy từ đúng tên Claim trong JWT
            if (userIdClaim == null)
                return Unauthorized("JWT không chứa UserID.");

            if (!int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized($"Lỗi khi parse UserID: {userIdClaim.Value}");

            var invite = _context.PhieuMoiPhienBauCus.FirstOrDefault(i => i.Token == token);

            if (invite == null)
                return NotFound("Không tìm thấy mã mời.");

            if (invite.NguoiTaoId != userId)
                return BadRequest("Bạn không có quyền thu hồi mã mời này.");

            if (invite.NgayHetHan <= DateTime.UtcNow)
            {
                invite.HieuLuc = false;
                _context.SaveChanges();
                return BadRequest(new
                {
                    message = "Lời mời đã hết hạn.",
                    expiredAt = invite.NgayHetHan
                });
            }

            invite.HieuLuc = false;
            _context.SaveChanges();

            return Ok("Mã mời đã bị thu hồi.");
        }

        [HttpPost("join")]
        [Authorize]
        public async Task<IActionResult> JoinElection([FromBody] JoinElectionDTO request)
        {
            if (string.IsNullOrEmpty(request.Token))
                return BadRequest("Token không hợp lệ hoặc bị thiếu.");

            var invite = await _context.PhieuMoiPhienBauCus
                .FirstOrDefaultAsync(i => i.Token == request.Token);

            if (invite == null || !invite.HieuLuc)
                return BadRequest("Lời mời không hợp lệ hoặc đã hết hạn.");

            if (invite.NgayHetHan <= DateTime.UtcNow)
            {
                await _context.SaveChangesAsync();
                return BadRequest(new
                {
                    message = "Lời mời đã hết hạn.",
                    expiredAt = invite.NgayHetHan
                });
            }

            if (User.Identity == null || !User.Identity.IsAuthenticated)
                return Unauthorized("Bạn cần đăng nhập để tiếp tục.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID");
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                return Unauthorized("Không thể xác định danh tính người dùng.");

            var user = await _context.TaiKhoan.FindAsync(userId);
            if (user == null)
                return NotFound("Không tìm thấy thông tin người dùng.");

            // 🔹 Kiểm tra xem user đã có trong danh sách cử tri chưa

            bool exists = await _context.CuTris.AnyAsync(c =>
                c.TaiKhoanId == userId &&
                c.PhienBauCuId == invite.PhienBauCuId &&
                c.CuocBauCuId == invite.CuocBauCuId);

            if (exists)
                return Conflict("Bạn đã tham gia phiên bầu cử này.");

            exists = await _context.CuTris.AnyAsync(c =>
            c.Email == user.Email && 
            c.PhienBauCuId == invite.PhienBauCuId &&
            c.CuocBauCuId == invite.CuocBauCuId);

            if (exists)
                return Conflict("Ðã có nguoi su dung email va sdt cua ban tham gia phien bau cu nay.");


            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var newCuTri = new CuTri
                {
                    Sdt = request.Sdt ?? string.Empty,
                    Email = user.Email,
                    XacMinh = user.TrangThai,
                    BoPhieu = false,
                    SoLanGuiOtp = 0,
                    CuocBauCuId = invite.CuocBauCuId,
                    PhienBauCuId = invite.PhienBauCuId,
                    TaiKhoanId = userId
                };

                await _context.CuTris.AddAsync(newCuTri);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
                return Ok(new { success = true, message = "Bạn đã tham gia phiên bầu cử thành công." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Lỗi hệ thống: {ex.Message}");
            }
        }


    }
}
