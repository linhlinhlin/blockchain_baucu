using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;
using WebApplication3.DTOs;
using WebApplication3.Services;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Globalization;

namespace WebApplication3.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DieuLeController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DieuLeController> _logger;
        private readonly IAzureBlobService _azureBlobService;
        private readonly IConfiguration _configuration;

        public DieuLeController(
            ApplicationDbContext context,
            ILogger<DieuLeController> logger,
            IAzureBlobService azureBlobService,
            IConfiguration configuration)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _azureBlobService = azureBlobService ?? throw new ArgumentNullException(nameof(azureBlobService));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        }

        // GET: api/DieuLe/cuocbaucu/{cuocBauCuId}
        [HttpGet("cuocbaucu/{cuocBauCuId}")]
        public async Task<IActionResult> GetDieuLeByCuocBauCuId(int cuocBauCuId)
        {
            // Kiểm tra quyền truy cập
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            // Tìm điều lệ mới nhất của cuộc bầu cử
            var dieuLe = await _context.DieuLes
                .Where(d => d.CuocBauCuId == cuocBauCuId)
                .OrderByDescending(d => d.PhienBan)
                .FirstOrDefaultAsync();

            if (dieuLe == null)
            {
                return NotFound(new { message = "Không tìm thấy điều lệ cho cuộc bầu cử này." });
            }

            // Lấy thông tin cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(cuocBauCuId);

            // Nếu điều lệ bao gồm file, tạo URL có SAS token
            if (!string.IsNullOrEmpty(dieuLe.TenFile))
            {
                bool blobExists = await _azureBlobService.BlobExistsAsync(dieuLe.TenFile);
                if (blobExists)
                {
                    // Tạo URL có SAS token để client có thể truy cập
                    dieuLe.FileUrl = _azureBlobService.GenerateSasToken(dieuLe.TenFile, 60); // Token hết hạn sau 60 phút
                }
            }

            // Tạo DTO response
            var response = new DieuLeResponseDTO
            {
                Id = dieuLe.Id,
                CuocBauCuId = dieuLe.CuocBauCuId,
                TieuDe = dieuLe.TieuDe,
                NoiDung = dieuLe.NoiDung,
                TenFile = dieuLe.TenFile,
                FileUrl = dieuLe.FileUrl,
                PhienBan = dieuLe.PhienBan,
                ThoiGianTao = dieuLe.ThoiGianTao.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                ThoiGianCapNhat = dieuLe.ThoiGianCapNhat.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanCapNhatId = dieuLe.TaiKhoanCapNhatId,
                DaCongBo = dieuLe.DaCongBo,
                YeuCauXacNhan = dieuLe.YeuCauXacNhan,
                TenCuocBauCu = cuocBauCu?.TenCuocBauCu
            };

            return Ok(response);
        }

        // GET: api/DieuLe/cuocbaucu/{cuocBauCuId}/phienban
        [HttpGet("cuocbaucu/{cuocBauCuId}/phienban")]
        public async Task<IActionResult> GetDanhSachPhienBan(int cuocBauCuId)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            var danhSachPhienBan = await _context.DieuLes
                .Where(d => d.CuocBauCuId == cuocBauCuId)
                .OrderByDescending(d => d.PhienBan)
                .ToListAsync();

            if (danhSachPhienBan == null || !danhSachPhienBan.Any())
            {
                return NotFound(new { message = "Không tìm thấy phiên bản điều lệ nào cho cuộc bầu cử này." });
            }

            // Lấy thông tin cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(cuocBauCuId);

            // Tạo danh sách DTO response
            var responseList = new List<DieuLeResponseDTO>();

            foreach (var dieuLe in danhSachPhienBan)
            {
                // Tạo URL có SAS token cho các file điều lệ
                if (!string.IsNullOrEmpty(dieuLe.TenFile))
                {
                    bool blobExists = await _azureBlobService.BlobExistsAsync(dieuLe.TenFile);
                    if (blobExists)
                    {
                        dieuLe.FileUrl = _azureBlobService.GenerateSasToken(dieuLe.TenFile, 60);
                    }
                }

                responseList.Add(new DieuLeResponseDTO
                {
                    Id = dieuLe.Id,
                    CuocBauCuId = dieuLe.CuocBauCuId,
                    TieuDe = dieuLe.TieuDe,
                    NoiDung = dieuLe.NoiDung,
                    TenFile = dieuLe.TenFile,
                    FileUrl = dieuLe.FileUrl,
                    PhienBan = dieuLe.PhienBan,
                    ThoiGianTao = dieuLe.ThoiGianTao.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    ThoiGianCapNhat = dieuLe.ThoiGianCapNhat.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    TaiKhoanCapNhatId = dieuLe.TaiKhoanCapNhatId,
                    DaCongBo = dieuLe.DaCongBo,
                    YeuCauXacNhan = dieuLe.YeuCauXacNhan,
                    TenCuocBauCu = cuocBauCu?.TenCuocBauCu
                });
            }

            return Ok(responseList);
        }

        // GET: api/DieuLe/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDieuLeById(int id)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            var dieuLe = await _context.DieuLes.FindAsync(id);
            if (dieuLe == null)
            {
                return NotFound(new { message = "Không tìm thấy điều lệ." });
            }

            // Lấy thông tin cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(dieuLe.CuocBauCuId);

            // Nếu điều lệ bao gồm file, tạo URL có SAS token
            if (!string.IsNullOrEmpty(dieuLe.TenFile))
            {
                bool blobExists = await _azureBlobService.BlobExistsAsync(dieuLe.TenFile);
                if (blobExists)
                {
                    dieuLe.FileUrl = _azureBlobService.GenerateSasToken(dieuLe.TenFile, 60);
                }
            }

            // Tạo DTO response
            var response = new DieuLeResponseDTO
            {
                Id = dieuLe.Id,
                CuocBauCuId = dieuLe.CuocBauCuId,
                TieuDe = dieuLe.TieuDe,
                NoiDung = dieuLe.NoiDung,
                TenFile = dieuLe.TenFile,
                FileUrl = dieuLe.FileUrl,
                PhienBan = dieuLe.PhienBan,
                ThoiGianTao = dieuLe.ThoiGianTao.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                ThoiGianCapNhat = dieuLe.ThoiGianCapNhat.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanCapNhatId = dieuLe.TaiKhoanCapNhatId,
                DaCongBo = dieuLe.DaCongBo,
                YeuCauXacNhan = dieuLe.YeuCauXacNhan,
                TenCuocBauCu = cuocBauCu?.TenCuocBauCu
            };

            return Ok(response);
        }

        // POST: api/DieuLe
        [HttpPost]
        public async Task<IActionResult> CreateDieuLe([FromBody] DieuLeDTO dto)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            // Kiểm tra quyền với cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(dto.CuocBauCuId);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            if (cuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền tạo điều lệ cho cuộc bầu cử ID {Id}", userId, dto.CuocBauCuId);
                return StatusCode(403, new { message = "Bạn không có quyền tạo điều lệ cho cuộc bầu cử này." });
            }

            // Xác định phiên bản mới
            int phienBanMoi = 1;
            var dieuLeMoiNhat = await _context.DieuLes
                .Where(d => d.CuocBauCuId == dto.CuocBauCuId)
                .OrderByDescending(d => d.PhienBan)
                .FirstOrDefaultAsync();

            if (dieuLeMoiNhat != null)
            {
                phienBanMoi = dieuLeMoiNhat.PhienBan + 1;
            }

            // Tạo điều lệ mới
            var dieuLeMoi = new DieuLe
            {
                CuocBauCuId = (int)dto.CuocBauCuId,
                TieuDe = dto.TieuDe,
                NoiDung = dto.NoiDung,
                PhienBan = phienBanMoi,
                DaCongBo = dto.DaCongBo,
                YeuCauXacNhan = dto.YeuCauXacNhan,
                ThoiGianTao = DateTime.UtcNow,
                ThoiGianCapNhat = DateTime.UtcNow,
                TaiKhoanCapNhatId = userId
            };

            _context.DieuLes.Add(dieuLeMoi);
            await _context.SaveChangesAsync();

            // Ghi log
            _logger.LogInformation("Người dùng {UserId} đã tạo điều lệ mới (ID: {DieuLeId}) cho cuộc bầu cử ID {CuocBauCuId}",
                userId, dieuLeMoi.Id, dto.CuocBauCuId);

            // Tạo DTO response
            var response = new DieuLeResponseDTO
            {
                Id = dieuLeMoi.Id,
                CuocBauCuId = dieuLeMoi.CuocBauCuId,
                TieuDe = dieuLeMoi.TieuDe,
                NoiDung = dieuLeMoi.NoiDung,
                PhienBan = dieuLeMoi.PhienBan,
                ThoiGianTao = dieuLeMoi.ThoiGianTao.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                ThoiGianCapNhat = dieuLeMoi.ThoiGianCapNhat.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanCapNhatId = dieuLeMoi.TaiKhoanCapNhatId,
                DaCongBo = dieuLeMoi.DaCongBo,
                YeuCauXacNhan = dieuLeMoi.YeuCauXacNhan,
                TenCuocBauCu = cuocBauCu.TenCuocBauCu
            };

            return CreatedAtAction(nameof(GetDieuLeById), new { id = dieuLeMoi.Id }, response);
        }

        // PUT: api/DieuLe/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDieuLe(int id, [FromBody] DieuLeDTO dto)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            var dieuLe = await _context.DieuLes.FindAsync(id);
            if (dieuLe == null)
            {
                return NotFound(new { message = "Không tìm thấy điều lệ." });
            }

            // Kiểm tra quyền với cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(dieuLe.CuocBauCuId);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            if (cuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền cập nhật điều lệ ID {DieuLeId}", userId, id);
                return StatusCode(403, new { message = "Bạn không có quyền cập nhật điều lệ này." });
            }

            // Cập nhật thông tin
            dieuLe.TieuDe = dto.TieuDe;
            dieuLe.NoiDung = dto.NoiDung;
            dieuLe.DaCongBo = dto.DaCongBo;
            dieuLe.YeuCauXacNhan = dto.YeuCauXacNhan;
            dieuLe.ThoiGianCapNhat = DateTime.UtcNow;
            dieuLe.TaiKhoanCapNhatId = userId;

            _context.Entry(dieuLe).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Người dùng {UserId} đã cập nhật điều lệ ID {DieuLeId}", userId, id);

            // Nếu điều lệ bao gồm file, tạo URL có SAS token
            if (!string.IsNullOrEmpty(dieuLe.TenFile))
            {
                bool blobExists = await _azureBlobService.BlobExistsAsync(dieuLe.TenFile);
                if (blobExists)
                {
                    dieuLe.FileUrl = _azureBlobService.GenerateSasToken(dieuLe.TenFile, 60);
                }
            }

            // Tạo DTO response
            var response = new DieuLeResponseDTO
            {
                Id = dieuLe.Id,
                CuocBauCuId = dieuLe.CuocBauCuId,
                TieuDe = dieuLe.TieuDe,
                NoiDung = dieuLe.NoiDung,
                TenFile = dieuLe.TenFile,
                FileUrl = dieuLe.FileUrl,
                PhienBan = dieuLe.PhienBan,
                ThoiGianTao = dieuLe.ThoiGianTao.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                ThoiGianCapNhat = dieuLe.ThoiGianCapNhat.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanCapNhatId = dieuLe.TaiKhoanCapNhatId,
                DaCongBo = dieuLe.DaCongBo,
                YeuCauXacNhan = dieuLe.YeuCauXacNhan,
                TenCuocBauCu = cuocBauCu.TenCuocBauCu
            };

            return Ok(response);
        }

        // DELETE: api/DieuLe/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDieuLe(int id)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            var dieuLe = await _context.DieuLes.FindAsync(id);
            if (dieuLe == null)
            {
                return NotFound(new { message = "Không tìm thấy điều lệ." });
            }

            // Kiểm tra quyền với cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(dieuLe.CuocBauCuId);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            if (cuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền xóa điều lệ ID {DieuLeId}", userId, id);
                return StatusCode(403, new { message = "Bạn không có quyền xóa điều lệ này." });
            }

            // Nếu có file, xóa file khỏi Azure Storage
            if (!string.IsNullOrEmpty(dieuLe.TenFile))
            {
                bool blobExists = await _azureBlobService.BlobExistsAsync(dieuLe.TenFile);
                if (blobExists)
                {
                    await _azureBlobService.DeleteBlobAsync(dieuLe.TenFile);
                }
            }

            _context.DieuLes.Remove(dieuLe);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Người dùng {UserId} đã xóa điều lệ ID {DieuLeId}", userId, id);

            return NoContent();
        }

        // POST: api/DieuLe/uploadFile/{cuocBauCuId}
        [HttpPost("uploadFile/{cuocBauCuId}")]
        public async Task<IActionResult> UploadFileDieuLe(int cuocBauCuId, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, message = "File không hợp lệ." });
            }

            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, message = "Không thể xác thực người dùng." });
            }

            // Kiểm tra quyền với cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(cuocBauCuId);
            if (cuocBauCu == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
            }

            if (cuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền tải lên điều lệ cho cuộc bầu cử ID {Id}", userId, cuocBauCuId);
                return StatusCode(403, new { success = false, message = "Bạn không có quyền tải lên điều lệ cho cuộc bầu cử này." });
            }

            try
            {
                // Tạo tên file duy nhất để tránh trùng lặp
                string uniqueFileName = $"dieule_{cuocBauCuId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";

                // Kiểm tra xem tên file đã tồn tại trên Azure chưa
                bool fileExists = await _azureBlobService.BlobExistsAsync(uniqueFileName);
                if (fileExists)
                {
                    // Nếu đã tồn tại, tạo tên file mới
                    uniqueFileName = $"dieule_{cuocBauCuId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                }

                string fileUrl;
                string sasUrl;

                // Upload file lên Azure Blob Storage sử dụng dịch vụ chung
                using (var stream = file.OpenReadStream())
                {
                    fileUrl = await _azureBlobService.UploadFileAsync(stream, uniqueFileName, file.ContentType);

                    // Tạo URL có SAS token để client có thể truy cập
                    sasUrl = _azureBlobService.GenerateSasToken(uniqueFileName, 60); // Token hết hạn sau 60 phút
                }

                // Xác định phiên bản mới
                int phienBanMoi = 1;
                var dieuLeMoiNhat = await _context.DieuLes
                    .Where(d => d.CuocBauCuId == cuocBauCuId)
                    .OrderByDescending(d => d.PhienBan)
                    .FirstOrDefaultAsync();

                if (dieuLeMoiNhat != null)
                {
                    phienBanMoi = dieuLeMoiNhat.PhienBan + 1;
                }

                // Lấy thời gian hiện tại ở múi giờ UTC
                var uploadTimeUtc = DateTimeOffset.UtcNow;
                var uploadTimeUtc7 = uploadTimeUtc.ToOffset(TimeSpan.FromHours(7));

                // Tạo bản ghi điều lệ mới
                var dieuLeMoi = new DieuLe
                {
                    CuocBauCuId = cuocBauCuId,
                    TieuDe = $"Điều lệ bầu cử {cuocBauCu.TenCuocBauCu} - Phiên bản {phienBanMoi}",
                    NoiDung = null, // Không có nội dung HTML vì là file
                    TenFile = uniqueFileName,
                    FileUrl = fileUrl,
                    PhienBan = phienBanMoi,
                    DaCongBo = false, // Mặc định chưa công bố
                    YeuCauXacNhan = true, // Mặc định yêu cầu xác nhận
                    ThoiGianTao = uploadTimeUtc.UtcDateTime,
                    ThoiGianCapNhat = uploadTimeUtc.UtcDateTime,
                    TaiKhoanCapNhatId = userId
                };

                _context.DieuLes.Add(dieuLeMoi);

                // Lưu thông tin vào bảng UploadFile
                var uploadFile = new UploadFile
                {
                    FileURL = fileUrl,
                    TenFileDuocTao = uniqueFileName,
                    TenFileGoc = file.FileName,
                    NoiDungType = file.ContentType,
                    KichThuoc = file.Length,
                    NgayUpload = uploadTimeUtc.UtcDateTime,
                    TaiKhoanUploadId = userId,
                    PhienBauCuUploadId = await GetPhienBauCuId(cuocBauCuId),
                    CuocBauCuUploadId = cuocBauCuId,
                    KichThuocHienThi = FormatFileSize(file.Length),
                    NgayHienThi = uploadTimeUtc7.ToString("dd/MM/yyyy HH:mm")
                };

                _context.UploadFiles.Add(uploadFile);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Tải file điều lệ thành công cho cuộc bầu cử ID: {Id}, Tên file: {FileName}", cuocBauCuId, uniqueFileName);

                return Ok(new
                {
                    success = true,
                    message = "Tải lên điều lệ thành công",
                    dieuLeId = dieuLeMoi.Id,
                    fileUrl = sasUrl,
                    fileName = uniqueFileName,
                    fileInfo = new
                    {
                        id = uploadFile.Id,
                        tenFile = uploadFile.TenFileDuocTao,
                        kichThuoc = uploadFile.KichThuocHienThi,
                        ngayUpload = uploadFile.NgayHienThi,
                        noiDungType = uploadFile.NoiDungType
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tải file điều lệ cho cuộc bầu cử ID: {Id}", cuocBauCuId);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi tải lên điều lệ: {ex.Message}" });
            }
        }

        // PATCH: api/DieuLe/{id}/congbo
        [HttpPatch("{id}/congbo")]
        public async Task<IActionResult> CapNhatTrangThaiCongBo(int id, [FromBody] CapNhatTrangThaiDTO dto)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { message = "Không thể xác thực người dùng." });
            }

            var dieuLe = await _context.DieuLes.FindAsync(id);
            if (dieuLe == null)
            {
                return NotFound(new { message = "Không tìm thấy điều lệ." });
            }

            // Kiểm tra quyền với cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(dieuLe.CuocBauCuId);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            if (cuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền cập nhật trạng thái điều lệ ID {DieuLeId}", userId, id);
                return StatusCode(403, new { message = "Bạn không có quyền cập nhật trạng thái điều lệ này." });
            }

            // Cập nhật trạng thái công bố
            dieuLe.DaCongBo = dto.DaCongBo;
            dieuLe.ThoiGianCapNhat = DateTime.UtcNow;
            dieuLe.TaiKhoanCapNhatId = userId;

            _context.Entry(dieuLe).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Người dùng {UserId} đã cập nhật trạng thái công bố điều lệ ID {DieuLeId} thành {TrangThai}",
                userId, id, dto.DaCongBo ? "Đã công bố" : "Chưa công bố");

            // Nếu điều lệ bao gồm file, tạo URL có SAS token
            if (!string.IsNullOrEmpty(dieuLe.TenFile))
            {
                bool blobExists = await _azureBlobService.BlobExistsAsync(dieuLe.TenFile);
                if (blobExists)
                {
                    dieuLe.FileUrl = _azureBlobService.GenerateSasToken(dieuLe.TenFile, 60);
                }
            }

            // Tạo DTO response
            var response = new DieuLeResponseDTO
            {
                Id = dieuLe.Id,
                CuocBauCuId = dieuLe.CuocBauCuId,
                TieuDe = dieuLe.TieuDe,
                NoiDung = dieuLe.NoiDung,
                TenFile = dieuLe.TenFile,
                FileUrl = dieuLe.FileUrl,
                PhienBan = dieuLe.PhienBan,
                ThoiGianTao = dieuLe.ThoiGianTao.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                ThoiGianCapNhat = dieuLe.ThoiGianCapNhat.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanCapNhatId = dieuLe.TaiKhoanCapNhatId,
                DaCongBo = dieuLe.DaCongBo,
                YeuCauXacNhan = dieuLe.YeuCauXacNhan,
                TenCuocBauCu = cuocBauCu.TenCuocBauCu
            };

            return Ok(response);
        }

        // POST: api/DieuLe/{dieuLeId}/thongbao
        [HttpPost("{dieuLeId}/thongbao")]
        public async Task<IActionResult> GuiThongBaoDieuLe(int dieuLeId, [FromBody] ThongBaoDieuLeDTO dto)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, message = "Không thể xác thực người dùng." });
            }

            var dieuLe = await _context.DieuLes.FindAsync(dieuLeId);
            if (dieuLe == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy điều lệ." });
            }

            // Kiểm tra quyền với cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(dieuLe.CuocBauCuId);
            if (cuocBauCu == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
            }

            if (cuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền gửi thông báo điều lệ ID {DieuLeId}", userId, dieuLeId);
                return StatusCode(403, new { success = false, message = "Bạn không có quyền gửi thông báo điều lệ này." });
            }

            try
            {
                // Lấy danh sách cử tri của cuộc bầu cử
                var danhSachCuTri = await _context.CuTris
                    .Where(c => c.CuocBauCuId == dieuLe.CuocBauCuId)
                    .Select(c => c.TaiKhoanId)
                    .Distinct()
                    .ToListAsync();

                // Tạo thông báo cho tất cả cử tri
                var thongBao = new List<ThongBao>();
                var now = DateTime.UtcNow;

                foreach (var nguoiNhanId in danhSachCuTri)
                {
                    if (nguoiNhanId.HasValue)
                    {
                        thongBao.Add(new ThongBao
                        {
                            TaiKhoanId = nguoiNhanId.Value,
                            TieuDe = "Điều lệ mới đã được công bố",
                            NoiDung = $"Điều lệ mới của cuộc bầu cử '{cuocBauCu.TenCuocBauCu}' đã được công bố. Vui lòng xem và xác nhận trước khi tham gia bỏ phiếu.",
                            NgayGui = now,
                            TrangThai = false // Chưa đọc
                        });
                    }
                }

                if (thongBao.Any())
                {
                    _context.ThongBaos.AddRange(thongBao);
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("Đã gửi thông báo điều lệ ID {DieuLeId} đến {SoLuong} cử tri", dieuLeId, thongBao.Count);
                }

                return Ok(new
                {
                    success = true,
                    message = $"Đã gửi thông báo thành công đến {thongBao.Count} cử tri."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gửi thông báo điều lệ ID {DieuLeId}", dieuLeId);
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Có lỗi khi gửi thông báo: {ex.Message}"
                });
            }
        }

        // POST: api/DieuLe/{dieuLeId}/xacnhan
        [HttpPost("{dieuLeId}/xacnhan")]
        public async Task<IActionResult> XacNhanDaDocDieuLe(int dieuLeId, [FromBody] XacNhanDieuLeDTO dto)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, message = "Không thể xác thực người dùng." });
            }

            if (userId != dto.TaiKhoanId)
            {
                return StatusCode(403, new { success = false, message = "Bạn không có quyền xác nhận cho người dùng khác." });
            }

            var dieuLe = await _context.DieuLes.FindAsync(dieuLeId);
            if (dieuLe == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy điều lệ." });
            }

            // Kiểm tra xem đã có xác nhận chưa
            var xacNhanHienTai = await _context.XacNhanDieuLes
                .FirstOrDefaultAsync(x => x.DieuLeId == dieuLeId && x.TaiKhoanId == dto.TaiKhoanId);

            if (xacNhanHienTai != null)
            {
                return Ok(new { success = true, message = "Bạn đã xác nhận điều lệ này trước đó." });
            }

            // Tạo xác nhận mới
            var xacNhanMoi = new XacNhanDieuLe
            {
                DieuLeId = dieuLeId,
                TaiKhoanId = dto.TaiKhoanId,
                ThoiGianXacNhan = DateTime.UtcNow
            };

            _context.XacNhanDieuLes.Add(xacNhanMoi);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Người dùng {UserId} đã xác nhận đã đọc điều lệ ID {DieuLeId}", dto.TaiKhoanId, dieuLeId);

            return Ok(new { success = true, message = "Đã xác nhận đọc điều lệ thành công." });
        }

        // GET: api/DieuLe/{dieuLeId}/xacnhan/{taiKhoanId}
        [HttpGet("{dieuLeId}/xacnhan/{taiKhoanId}")]
        public async Task<IActionResult> KiemTraXacNhanDieuLe(int dieuLeId, int taiKhoanId)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, message = "Không thể xác thực người dùng." });
            }

            if (userId != taiKhoanId)
            {
                return StatusCode(403, new { success = false, message = "Bạn không có quyền kiểm tra xác nhận của người dùng khác." });
            }

            var xacNhan = await _context.XacNhanDieuLes
                .FirstOrDefaultAsync(x => x.DieuLeId == dieuLeId && x.TaiKhoanId == taiKhoanId);

            if (xacNhan == null)
            {
                return Ok(new { daXacNhan = false });
            }

            return Ok(new
            {
                daXacNhan = true,
                thoiGianXacNhan = xacNhan.ThoiGianXacNhan.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)
            });
        }

        private string FormatFileSize(long bytes)
        {
            if (bytes >= 1048576)
                return $"{bytes / 1048576.0:F2} MB";
            else if (bytes >= 1024)
                return $"{bytes / 1024.0:F2} KB";
            else
                return $"{bytes} bytes";
        }

        // Helper method để lấy PhienBauCuId liên quan đến cuộc bầu cử
        private async Task<int> GetPhienBauCuId(int cuocBauCuId)
        {
            // Tìm phiên bầu cử đầu tiên liên quan đến cuộc bầu cử này
            var phienBauCu = await _context.PhienBauCus
                .Where(p => p.CuocBauCuId == cuocBauCuId)
                .OrderBy(p => p.Id)
                .FirstOrDefaultAsync();

            // Nếu không tìm thấy, mặc định là 1 (hoặc giá trị mặc định khác phù hợp với hệ thống)
            return phienBauCu?.Id ?? 1;
        }
    }
}