using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;
using WebApplication3.Models;
using WebApplication3.Data;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Collections.Generic;

namespace WebApplication3.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ViBlockchainController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ViBlockchainController> _logger;

        public ViBlockchainController(
            ApplicationDbContext context,
            ILogger<ViBlockchainController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Lấy thông tin ví blockchain dựa trên ID tài khoản và địa chỉ ví
        /// </summary>
        [HttpGet("get-vi-by-address")]
        [Authorize]
        public async Task<IActionResult> GetViByAddress(int taiKhoanId, string diaChiVi)
        {
            if (taiKhoanId <= 0 || string.IsNullOrEmpty(diaChiVi))
            {
                return BadRequest(new { Success = false, Message = "Tài khoản ID hoặc địa chỉ ví không hợp lệ." });
            }

            try
            {
                // Kiểm tra quyền - người dùng chỉ có thể xem ví của chính mình
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != taiKhoanId)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền xem ví của TaiKhoanId {TaiKhoanId}", userIdClaim, taiKhoanId);
                    return StatusCode(403, new { Success = false, Message = "Bạn không có quyền xem thông tin ví này." });
                }

                // Tìm ví dựa trên TaiKhoanId và DiaChiVi
                var viBlockchain = await _context.ViBlockchain
                    .Where(v => v.TaiKhoanId == taiKhoanId && v.DiaChiVi.ToLower() == diaChiVi.ToLower())
                    .FirstOrDefaultAsync();

                if (viBlockchain == null)
                {
                    _logger.LogWarning("Không tìm thấy ví blockchain với địa chỉ {DiaChiVi} cho TaiKhoanID {TaiKhoanID}", diaChiVi, taiKhoanId);
                    return NotFound(new
                    {
                        Success = false,
                        Message = "Không tìm thấy ví blockchain với địa chỉ này cho tài khoản của bạn."
                    });
                }

                // Tạo DTO để trả về
                var viDto = new ViBlockchainDTO
                {
                    ViId = viBlockchain.ViId,
                    TaiKhoanId = viBlockchain.TaiKhoanId,
                    DiaChiVi = viBlockchain.DiaChiVi,
                    LoaiVi = viBlockchain.LoaiVi,
                    SCWNonce = viBlockchain.SCWNonce,
                    ThoiGianTao = viBlockchain.ThoiGianTao,
                    TrangThai = viBlockchain.TrangThai,
                    IsPrimaryWallet = viBlockchain.IsPrimaryWallet,
                    NguonTao = viBlockchain.NguonTao
                };

                return Ok(new
                {
                    Success = true,
                    Data = viDto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy thông tin ví blockchain: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Lấy danh sách ví blockchain của một tài khoản
        /// </summary>
        [HttpGet("get-vi-list")]
        [Authorize]
        public async Task<IActionResult> GetViList(int taiKhoanId)
        {
            if (taiKhoanId <= 0)
            {
                return BadRequest(new { Success = false, Message = "Tài khoản ID không hợp lệ." });
            }

            try
            {
                // Kiểm tra quyền - người dùng chỉ có thể xem ví của chính mình
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != taiKhoanId)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền xem ví của TaiKhoanId {TaiKhoanId}", userIdClaim, taiKhoanId);
                    return StatusCode(403, new { Success = false, Message = "Bạn không có quyền xem thông tin ví này." });
                }

                // Lấy danh sách ví của tài khoản
                var viList = await _context.ViBlockchain
                    .Where(v => v.TaiKhoanId == taiKhoanId)
                    .Select(v => new ViBlockchainDTO
                    {
                        ViId = v.ViId,
                        TaiKhoanId = v.TaiKhoanId,
                        DiaChiVi = v.DiaChiVi,
                        LoaiVi = v.LoaiVi,
                        SCWNonce = v.SCWNonce,
                        ThoiGianTao = v.ThoiGianTao,
                        TrangThai = v.TrangThai,
                        IsPrimaryWallet = v.IsPrimaryWallet,
                        NguonTao = v.NguonTao
                    })
                    .ToListAsync();

                if (viList.Count == 0)
                {
                    _logger.LogWarning("Không tìm thấy ví blockchain nào cho TaiKhoanID {TaiKhoanID}", taiKhoanId);
                    return NotFound(new
                    {
                        Success = false,
                        Message = "Không tìm thấy ví blockchain nào cho tài khoản của bạn."
                    });
                }

                return Ok(new
                {
                    Success = true,
                    Data = viList
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách ví blockchain: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Lấy ví blockchain chính của một tài khoản
        /// </summary>
        [HttpGet("get-primary-wallet")]
        [Authorize]
        public async Task<IActionResult> GetPrimaryWallet(int taiKhoanId)
        {
            if (taiKhoanId <= 0)
            {
                return BadRequest(new { Success = false, Message = "Tài khoản ID không hợp lệ." });
            }

            try
            {
                // Kiểm tra quyền - người dùng chỉ có thể xem ví của chính mình
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != taiKhoanId)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền xem ví của TaiKhoanId {TaiKhoanId}", userIdClaim, taiKhoanId);
                    return StatusCode(403, new { Success = false, Message = "Bạn không có quyền xem thông tin ví này." });
                }

                // Tìm ví chính của tài khoản
                var primaryWallet = await _context.ViBlockchain
                    .Where(v => v.TaiKhoanId == taiKhoanId && v.IsPrimaryWallet)
                    .FirstOrDefaultAsync();

                if (primaryWallet == null)
                {
                    _logger.LogWarning("Không tìm thấy ví chính cho TaiKhoanID {TaiKhoanID}", taiKhoanId);
                    return NotFound(new
                    {
                        Success = false,
                        Message = "Không tìm thấy ví chính cho tài khoản của bạn."
                    });
                }

                // Tạo DTO để trả về
                var viDto = new ViBlockchainDTO
                {
                    ViId = primaryWallet.ViId,
                    TaiKhoanId = primaryWallet.TaiKhoanId,
                    DiaChiVi = primaryWallet.DiaChiVi,
                    LoaiVi = primaryWallet.LoaiVi,
                    SCWNonce = primaryWallet.SCWNonce,
                    ThoiGianTao = primaryWallet.ThoiGianTao,
                    TrangThai = primaryWallet.TrangThai,
                    IsPrimaryWallet = primaryWallet.IsPrimaryWallet,
                    NguonTao = primaryWallet.NguonTao
                };

                return Ok(new
                {
                    Success = true,
                    Data = viDto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy ví chính: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }
    }
}