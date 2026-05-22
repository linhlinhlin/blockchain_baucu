using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;
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
    public class CuocBauCuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CuocBauCuController> _logger;
        private readonly IAzureBlobService _azureBlobService;

        public CuocBauCuController(
            ApplicationDbContext context,
            ILogger<CuocBauCuController> logger,
            IAzureBlobService azureBlobService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _azureBlobService = azureBlobService ?? throw new ArgumentNullException(nameof(azureBlobService));
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAll()
        {
            var cuocBauCuList = await _context.CuocBauCus.ToListAsync();
            var dtoList = cuocBauCuList.Select(c => new CuocBauCuDetailDTO
            {
                Id = c.Id,
                TenCuocBauCu = c.TenCuocBauCu,
                MoTa = c.MoTa,
                NgayBatDau = c.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = c.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanId = c.TaiKhoanId,
                TrangThaiBlockchain = c.TrangThaiBlockchain,
                BlockchainAddress = c.BlockchainAddress,
                BlockchainServerId = c.BlockchainServerId,
            }).ToList();

            return Ok(dtoList);
        }

        [HttpGet("layId/{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            var dto = new CuocBauCuDTO
            {
                Id = cuocBauCu.Id,
                TenCuocBauCu = cuocBauCu.TenCuocBauCu,
                MoTa = cuocBauCu.MoTa,
                NgayBatDau = cuocBauCu.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = cuocBauCu.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanId = cuocBauCu.TaiKhoanId,
                AnhCuocBauCu = cuocBauCu.AnhCuocBauCu,
                BlockchainServerId = cuocBauCu.BlockchainServerId,
                BlockchainAddress = cuocBauCu.BlockchainAddress,
            };

            return Ok(dto);
        }

        [HttpGet("details/{id}")]
        public async Task<IActionResult> GetDetails(int id)
        {
            var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            var dto = new CuocBauCuDetailDTO
            {
                Id = cuocBauCu.Id,
                TenCuocBauCu = cuocBauCu.TenCuocBauCu,
                MoTa = cuocBauCu.MoTa,
                NgayBatDau = cuocBauCu.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = cuocBauCu.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanId = cuocBauCu.TaiKhoanId,
                AnhCuocBauCu = cuocBauCu.AnhCuocBauCu,
                BlockchainServerId = cuocBauCu.BlockchainServerId,
                BlockchainAddress = cuocBauCu.BlockchainAddress,
                TrangThaiBlockchain = cuocBauCu.TrangThaiBlockchain,
                ErrorMessage = cuocBauCu.ErrorMessage
            };

            return Ok(dto);
        }

        [HttpPost("tao")]
        public async Task<IActionResult> Create([FromBody] CuocBauCuDTO dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "Dữ liệu không hợp lệ." });
            }

            if (!DateTime.TryParseExact(dto.NgayBatDau, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayBatDau) ||
                !DateTime.TryParseExact(dto.NgayKetThuc, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayKetThuc))
            {
                return BadRequest(new { message = "Ngày không hợp lệ. Vui lòng nhập ngày theo định dạng dd/MM/yyyy HH:mm." });
            }

            if (ngayBatDau > ngayKetThuc)
            {
                return BadRequest(new { message = "Ngày bắt đầu không được lớn hơn ngày kết thúc." });
            }

            var today = DateTime.Today;
            if (ngayBatDau < today)
            {
                return BadRequest(new { message = "Ngày bắt đầu phải ít nhất là 00:00 ngày hôm nay." });
            }

            // Sửa ở đây: Tìm claim "UserID" thay vì ClaimTypes.NameIdentifier
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != dto.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền tạo cuộc bầu cử cho TaiKhoanId {TaiKhoanId}", userIdClaim, dto.TaiKhoanId);
                return StatusCode(403, new { message = "Bạn không có quyền tạo cuộc bầu cử cho tài khoản này." });
            }

            var existingCuocBauCu = await _context.CuocBauCus
                .FirstOrDefaultAsync(c => c.TenCuocBauCu == dto.TenCuocBauCu);
            if (existingCuocBauCu != null)
            {
                return BadRequest(new { message = "Tên cuộc bầu cử đã tồn tại." });
            }

            var newCuocBauCu = new CuocBauCu
            {
                TenCuocBauCu = dto.TenCuocBauCu,
                MoTa = dto.MoTa,
                NgayBatDau = ngayBatDau,
                NgayKetThuc = ngayKetThuc,
                TaiKhoanId = dto.TaiKhoanId,
                TrangThaiBlockchain = 0 // Chưa triển khai
            };

            _context.CuocBauCus.Add(newCuocBauCu);
            await _context.SaveChangesAsync();

            dto.Id = newCuocBauCu.Id;

            await CreatePhienBauCu(newCuocBauCu.Id, dto.TenCuocBauCu, dto.MoTa, ngayBatDau, ngayKetThuc);

            return CreatedAtAction(nameof(GetById), new { id = newCuocBauCu.Id }, dto);
        }

        private async Task CreatePhienBauCu(int cuocBauCuId, string tenCuocBauCu, string moTa, DateTime ngayBatDau, DateTime ngayKetThuc)
        {
            var phienBauCu = new PhienBauCu
            {
                TenPhienBauCu = $"Phiên bầu cử của {tenCuocBauCu}",
                CuocBauCuId = cuocBauCuId,
                MoTa = "Hãy thêm mô tả nhé",
                NgayBatDau = ngayBatDau,
                NgayKetThuc = ngayKetThuc
            };

            _context.PhienBauCus.Add(phienBauCu);
            await _context.SaveChangesAsync();
        }

        [HttpPut("update")]
        public async Task<IActionResult> Update([FromBody] CuocBauCuDTO dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "Dữ liệu không hợp lệ." });
            }

            if (!DateTime.TryParseExact(dto.NgayBatDau, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayBatDau) ||
                !DateTime.TryParseExact(dto.NgayKetThuc, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayKetThuc))
            {
                return BadRequest(new { message = "Ngày không hợp lệ. Vui lòng nhập ngày theo định dạng dd/MM/yyyy HH:mm." });
            }

            if (ngayBatDau > ngayKetThuc)
            {
                return BadRequest(new { message = "Ngày bắt đầu không được lớn hơn ngày kết thúc." });
            }

            var today = DateTime.Today;
            if (ngayBatDau < today)
            {
                return BadRequest(new { message = "Ngày bắt đầu phải ít nhất là 00:00 ngày hôm nay." });
            }

            var cuocBauCu = await _context.CuocBauCus.FindAsync(dto.Id);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            var userIdClaim = User.FindFirst("UserID")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền cập nhật cuộc bầu cử ID {Id}", userIdClaim, dto.Id);
                return StatusCode(403, new { message = "Bạn không có quyền cập nhật cuộc bầu cử này." });
            }

            var existingCuocBauCu = await _context.CuocBauCus
                .FirstOrDefaultAsync(c => c.TenCuocBauCu == dto.TenCuocBauCu && c.Id != dto.Id);
            if (existingCuocBauCu != null)
            {
                return BadRequest(new { message = "Tên cuộc bầu cử đã tồn tại." });
            }

            var daDeploy = await _context.CuocBauCus.FirstOrDefaultAsync(c => c.Id == dto.Id && (c.TrangThaiBlockchain == 1 || c.TrangThaiBlockchain==2));
            if (daDeploy != null)
            {
                return BadRequest(new { message = "Cuộc bầu cử đã hoac dang được triển khai, không thể cập nhật." });
            }

            cuocBauCu.TenCuocBauCu = dto.TenCuocBauCu;
            cuocBauCu.MoTa = dto.MoTa;
            cuocBauCu.NgayBatDau = ngayBatDau;
            cuocBauCu.NgayKetThuc = ngayKetThuc;
            cuocBauCu.TaiKhoanId = dto.TaiKhoanId;

            _context.Entry(cuocBauCu).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            var userIdClaim = User.FindFirst("UserID")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền xóa cuộc bầu cử ID {Id}", userIdClaim, id);
                return StatusCode(403, new { message = "Bạn không có quyền xóa cuộc bầu cử này." });
            }

            _context.CuocBauCus.Remove(cuocBauCu);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("tim/{tenCuocBauCu}")]
        public async Task<IActionResult> GetByTenCuocBauCu(string tenCuocBauCu)
        {
            var cuocBauCu = await _context.CuocBauCus
                .FirstOrDefaultAsync(c => c.TenCuocBauCu == tenCuocBauCu);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            var dto = new CuocBauCuDetailDTO
            {
                Id = cuocBauCu.Id,
                TenCuocBauCu = cuocBauCu.TenCuocBauCu,
                MoTa = cuocBauCu.MoTa,
                NgayBatDau = cuocBauCu.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = cuocBauCu.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanId = cuocBauCu.TaiKhoanId,
                TrangThaiBlockchain = cuocBauCu.TrangThaiBlockchain,
                BlockchainAddress = cuocBauCu.BlockchainAddress,
                BlockchainServerId = cuocBauCu.BlockchainServerId,
            };

            return Ok(dto);
        }

        [HttpGet("taikhoan/{taiKhoanId}")]
        public async Task<IActionResult> GetByTaiKhoanId(int taiKhoanId)
        {
            var userIdClaim = User.FindFirst("UserID")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != taiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền xem danh sách cuộc bầu cử của TaiKhoanId {TaiKhoanId}", userIdClaim, taiKhoanId);
                return StatusCode(403, new { message = "Bạn không có quyền xem danh sách này." });
            }

            var cuocBauCuList = await _context.CuocBauCus
                .Where(c => c.TaiKhoanId == taiKhoanId)
                .ToListAsync();

            if (cuocBauCuList == null || !cuocBauCuList.Any())
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử nào cho tài khoản này." });
            }

            var dtoList = cuocBauCuList.Select(c => new CuocBauCuDTO
            {
                Id = c.Id,
                TenCuocBauCu = c.TenCuocBauCu,
                MoTa = c.MoTa,
                NgayBatDau = c.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = c.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                TaiKhoanId = c.TaiKhoanId,
                AnhCuocBauCu = c.AnhCuocBauCu,
                BlockchainServerId = c.BlockchainServerId,
                BlockchainAddress = c.BlockchainAddress,
            }).ToList();

            return Ok(dtoList);
        }

        [HttpPost("uploadImage/{id}")]
        public async Task<IActionResult> UploadImage(int id, IFormFile imageFile)
        {
            if (imageFile == null || imageFile.Length == 0)
            {
                return BadRequest(new { success = false, message = "File ảnh không hợp lệ." });
            }

            var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
            if (cuocBauCu == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
            }

            var userIdClaim = User.FindFirst("UserID")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền tải ảnh cho cuộc bầu cử ID {Id}", userIdClaim, id);
                return StatusCode(403, new { success = false, message = "Bạn không có quyền tải ảnh cho cuộc bầu cử này." });
            }

            try
            {
                // Tạo tên file duy nhất để tránh trùng lặp
                string uniqueFileName = $"election_{id}_{Guid.NewGuid()}{Path.GetExtension(imageFile.FileName)}";

                // Kiểm tra xem tên file đã tồn tại trên Azure chưa
                bool fileExists = await _azureBlobService.BlobExistsAsync(uniqueFileName);
                if (fileExists)
                {
                    // Nếu đã tồn tại, tạo tên file mới
                    uniqueFileName = $"election_{id}_{Guid.NewGuid()}{Path.GetExtension(imageFile.FileName)}";
                }

                string fileUrl;
                string sasUrl;

                // Upload file lên Azure Blob Storage sử dụng dịch vụ chung
                using (var stream = imageFile.OpenReadStream())
                {
                    fileUrl = await _azureBlobService.UploadFileAsync(stream, uniqueFileName, imageFile.ContentType);

                    // Tạo URL có SAS token để client có thể truy cập
                    sasUrl = _azureBlobService.GenerateSasToken(uniqueFileName, 60); // Token hết hạn sau 60 phút
                }

                // Lấy thời gian hiện tại ở múi giờ UTC
                var uploadTimeUtc = DateTimeOffset.UtcNow;
                var uploadTimeUtc7 = uploadTimeUtc.ToOffset(TimeSpan.FromHours(7));

                // 1. Cập nhật thông tin trong bảng CuocBauCu
                cuocBauCu.AnhCuocBauCu = uniqueFileName;

                // 2. Lưu thông tin vào bảng UploadFile
                var uploadFile = new UploadFile
                {
                    FileURL = fileUrl,
                    TenFileDuocTao = uniqueFileName,
                    TenFileGoc = imageFile.FileName,
                    NoiDungType = imageFile.ContentType,
                    KichThuoc = imageFile.Length,
                    NgayUpload = uploadTimeUtc.UtcDateTime,
                    TaiKhoanUploadId = userId,
                    PhienBauCuUploadId = await GetPhienBauCuId(id), // Lấy PhienBauCuId từ cuộc bầu cử
                    CuocBauCuUploadId = id,
                    KichThuocHienThi = FormatFileSize(imageFile.Length),
                    NgayHienThi = uploadTimeUtc7.ToString("dd/MM/yyyy HH:mm")
                };

                _context.UploadFiles.Add(uploadFile);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Tải ảnh thành công cho cuộc bầu cử ID: {Id}, Tên file: {FileName}", id, uniqueFileName);

                return Ok(new
                {
                    success = true,
                    message = "Tải lên ảnh thành công",
                    imageUrl = sasUrl,
                    fileName = uniqueFileName,
                    fileInfo = new
                    {
                        id = uploadFile.Id,
                        tenFile = uploadFile.TenFileDuocTao,
                        kichThuoc = uploadFile.KichThuocHienThi,
                        ngayUpload = uploadFile.NgayHienThi
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tải ảnh cho cuộc bầu cử ID: {Id}", id);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi tải lên ảnh: {ex.Message}" });
            }
        }

        // Thêm API mới để lấy ảnh của cuộc bầu cử với SAS token
        [HttpGet("getImage/{id}")]
        public async Task<IActionResult> GetImage(int id)
        {
            try
            {
                var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
                if (cuocBauCu == null)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
                }

                // Kiểm tra xem có ảnh không
                if (string.IsNullOrEmpty(cuocBauCu.AnhCuocBauCu))
                {
                    return NotFound(new { success = false, message = "Cuộc bầu cử này chưa có ảnh." });
                }

                // Tìm thông tin chi tiết trong bảng UploadFile
                var uploadFile = await _context.UploadFiles
                    .FirstOrDefaultAsync(f => f.TenFileDuocTao == cuocBauCu.AnhCuocBauCu && f.CuocBauCuUploadId == id);

                // Kiểm tra xem blob có tồn tại không
                bool blobExists = await _azureBlobService.BlobExistsAsync(cuocBauCu.AnhCuocBauCu);
                if (!blobExists)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy file ảnh trên Azure." });
                }

                // Tạo URL với SAS token
                string sasUrl = _azureBlobService.GenerateSasToken(cuocBauCu.AnhCuocBauCu, 60);

                var result = new
                {
                    success = true,
                    imageUrl = sasUrl,
                    fileName = cuocBauCu.AnhCuocBauCu
                };

                // Nếu có thông tin file trong UploadFile, bổ sung thêm
                if (uploadFile != null)
                {
                    return Ok(new
                    {
                        success = true,
                        imageUrl = sasUrl,
                        fileName = cuocBauCu.AnhCuocBauCu,
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

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy ảnh cho cuộc bầu cử ID: {Id}", id);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi lấy ảnh: {ex.Message}" });
            }
        }

        // Thêm API để lấy danh sách ảnh của nhiều cuộc bầu cử
        [HttpGet("getImages")]
        public async Task<IActionResult> GetImages([FromQuery] int[] ids)
        {
            if (ids == null || ids.Length == 0)
            {
                return BadRequest(new { success = false, message = "Cần cung cấp ít nhất một ID cuộc bầu cử." });
            }

            try
            {
                var cuocBauCus = await _context.CuocBauCus
                    .Where(c => ids.Contains(c.Id) && !string.IsNullOrEmpty(c.AnhCuocBauCu))
                    .ToListAsync();

                // Lấy danh sách các tên file ảnh
                var fileNames = cuocBauCus.Select(c => c.AnhCuocBauCu!).ToList();

                // Lấy thông tin file từ UploadFile
                var uploadFiles = await _context.UploadFiles
                    .Where(f => fileNames.Contains(f.TenFileDuocTao) && ids.Contains(f.CuocBauCuUploadId))
                    .ToListAsync();

                var result = new List<object>();

                foreach (var cuocBauCu in cuocBauCus)
                {
                    var imageFileName = cuocBauCu.AnhCuocBauCu;
                    if (string.IsNullOrWhiteSpace(imageFileName))
                    {
                        continue;
                    }

                    bool blobExists = await _azureBlobService.BlobExistsAsync(imageFileName);
                    if (blobExists)
                    {
                        string sasUrl = _azureBlobService.GenerateSasToken(imageFileName, 60);

                        var uploadFile = uploadFiles.FirstOrDefault(f => f.TenFileDuocTao == imageFileName && f.CuocBauCuUploadId == cuocBauCu.Id);

                        var imageInfo = new
                        {
                            cuocBauCuId = cuocBauCu.Id,
                            imageUrl = sasUrl,
                            fileName = imageFileName
                        };

                        // Nếu có thông tin trong UploadFile, bổ sung thêm
                        if (uploadFile != null)
                        {
                            var detailedImageInfo = new
                            {
                                cuocBauCuId = cuocBauCu.Id,
                                imageUrl = sasUrl,
                                fileName = imageFileName,
                                fileInfo = new
                                {
                                    id = uploadFile.Id,
                                    tenFile = uploadFile.TenFileDuocTao,
                                    kichThuoc = uploadFile.KichThuocHienThi,
                                    ngayUpload = uploadFile.NgayHienThi,
                                    noiDungType = uploadFile.NoiDungType
                                }
                            };
                            result.Add(detailedImageInfo);
                        }
                        else
                        {
                            result.Add(imageInfo);
                        }
                    }
                }

                return Ok(new
                {
                    success = true,
                    images = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách ảnh cho các cuộc bầu cử");
                return StatusCode(500, new { success = false, message = $"Có lỗi khi lấy danh sách ảnh: {ex.Message}" });
            }
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

        [HttpDelete("deleteImage/{id}")]
        public async Task<IActionResult> DeleteImage(int id, [FromQuery] string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return BadRequest(new { success = false, message = "Tên file không được để trống." });
            }

            try
            {
                var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
                if (cuocBauCu == null)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
                }

                // Kiểm tra quyền người dùng
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền xóa ảnh cho cuộc bầu cử ID {Id}", userIdClaim, id);
                    return StatusCode(403, new { success = false, message = "Bạn không có quyền xóa ảnh cho cuộc bầu cử này." });
                }

                // Kiểm tra xem ảnh có thuộc về cuộc bầu cử này không
                if (cuocBauCu.AnhCuocBauCu != fileName)
                {
                    return BadRequest(new { success = false, message = "Ảnh không thuộc về cuộc bầu cử này." });
                }

                // Kiểm tra sự tồn tại của blob trên Azure
                bool exists = await _azureBlobService.BlobExistsAsync(fileName);
                if (!exists)
                {
                    // Nếu không tồn tại trên Azure, cập nhật CSDL và trả về thành công
                    cuocBauCu.AnhCuocBauCu = null;
                    await _context.SaveChangesAsync();

                    _logger.LogWarning("File không tồn tại trên Azure nhưng đã cập nhật DB: {FileName}", fileName);
                    return Ok(new { success = true, message = "Đã xóa tham chiếu đến ảnh khỏi cuộc bầu cử." });
                }

                // Tìm bản ghi trong bảng UploadFile
                var uploadFile = await _context.UploadFiles
                    .FirstOrDefaultAsync(f => f.TenFileDuocTao == fileName && f.CuocBauCuUploadId == id);

                // 1. Xóa tham chiếu trong bảng CuocBauCu
                cuocBauCu.AnhCuocBauCu = null;

                // 2. Xóa bản ghi trong bảng UploadFile nếu có
                if (uploadFile != null)
                {
                    _context.UploadFiles.Remove(uploadFile);
                }

                await _context.SaveChangesAsync();

                // 3. Xóa blob trên Azure
                await _azureBlobService.DeleteBlobAsync(fileName);

                _logger.LogInformation("Xóa ảnh thành công cho cuộc bầu cử ID: {Id}, Tên file: {FileName}", id, fileName);
                return Ok(new { success = true, message = "Xóa ảnh thành công." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xóa ảnh cho cuộc bầu cử ID: {Id}, Tên file: {FileName}", id, fileName);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi xóa ảnh: {ex.Message}" });
            }
        }
    }

}
