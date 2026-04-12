using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Web3;
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
using DocumentFormat.OpenXml.Spreadsheet;
using Nethereum.ABI.FunctionEncoding.Attributes;
using DocumentFormat.OpenXml.Drawing.Charts;
using Microsoft.AspNetCore.Http.HttpResults;

namespace WebApplication3.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CuocBauCuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CuocBauCuController> _logger;
        private readonly BlockchainServerService _blockchainServerService;
        private readonly BlockchainService _blockchainService;

        private readonly IConfiguration _configuration;
        private readonly IAzureBlobService _azureBlobService;

        public CuocBauCuController(
            ApplicationDbContext context,
            ILogger<CuocBauCuController> logger,
            BlockchainServerService blockchainServerService,
            BlockchainService blockchainService,
            IConfiguration configuration,
            IAzureBlobService azureBlobService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _blockchainServerService = blockchainServerService ?? throw new ArgumentNullException(nameof(blockchainServerService));
            _blockchainService = blockchainService ?? throw new ArgumentNullException(nameof(blockchainService));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
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
                var fileNames = cuocBauCus.Select(c => c.AnhCuocBauCu).ToList();

                // Lấy thông tin file từ UploadFile
                var uploadFiles = await _context.UploadFiles
                    .Where(f => fileNames.Contains(f.TenFileDuocTao) && ids.Contains(f.CuocBauCuUploadId))
                    .ToListAsync();

                var result = new List<object>();

                foreach (var cuocBauCu in cuocBauCus)
                {
                    bool blobExists = await _azureBlobService.BlobExistsAsync(cuocBauCu.AnhCuocBauCu);
                    if (blobExists)
                    {
                        string sasUrl = _azureBlobService.GenerateSasToken(cuocBauCu.AnhCuocBauCu, 60);

                        var uploadFile = uploadFiles.FirstOrDefault(f => f.TenFileDuocTao == cuocBauCu.AnhCuocBauCu && f.CuocBauCuUploadId == cuocBauCu.Id);

                        var imageInfo = new
                        {
                            cuocBauCuId = cuocBauCu.Id,
                            imageUrl = sasUrl,
                            fileName = cuocBauCu.AnhCuocBauCu
                        };

                        // Nếu có thông tin trong UploadFile, bổ sung thêm
                        if (uploadFile != null)
                        {
                            var detailedImageInfo = new
                            {
                                cuocBauCuId = cuocBauCu.Id,
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

        [HttpGet("blockchain/{id}")]
        public async Task<IActionResult> GetBlockchainStatus(int id)
        {
            var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
            if (cuocBauCu == null)
            {
                return NotFound(new { message = "Không tìm thấy cuộc bầu cử." });
            }

            var userIdClaim = User.FindFirst("UserID")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền xem trạng thái blockchain của cuộc bầu cử ID {Id}", userIdClaim, id);
                return StatusCode(403, new { message = "Bạn không có quyền xem trạng thái này." });
            }

            var transaction = await _context.BlockchainTransactions
                .Where(t => t.DoiTuongId == id && t.LoaiDoiTuong == "CuocBauCu" && t.LoaiGiaoDich == "DEPLOY_SERVER")
                .OrderByDescending(t => t.NgayTao)
                .FirstOrDefaultAsync();

            var result = new
            {
                Success = cuocBauCu.TrangThaiBlockchain == 2,
                Status = cuocBauCu.TrangThaiBlockchain,
                BlockchainServerId = cuocBauCu.BlockchainServerId,
                BlockchainAddress = cuocBauCu.BlockchainAddress,
                ErrorMessage = cuocBauCu.ErrorMessage,
                TransactionHash = transaction?.TransactionHash,
                PaymasterUsed = cuocBauCu.TrangThaiBlockchain != 0 // Giả định Paymaster được dùng nếu có triển khai
            };

            return Ok(result);
        }

        [HttpPost("deployBlockchain/{id}")]
        public async Task<IActionResult> DeployBlockchain(int id, [FromBody] DeployBlockchainRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.SCWAddress) || !request.SCWAddress.StartsWith("0x") || request.SCWAddress.Length != 42)
            {
                _logger.LogWarning("Địa chỉ SCW không hợp lệ: {SCWAddress}", request?.SCWAddress);
                return BadRequest(new { success = false, message = "Địa chỉ SCW không hợp lệ." });
            }

            var cuocBauCu = await _context.CuocBauCus.FirstOrDefaultAsync(c => c.Id == id);
            if (cuocBauCu == null)
            {
                _logger.LogWarning("Không tìm thấy cuộc bầu cử với ID: {Id}", id);
                return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
            }

            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền triển khai blockchain cho cuộc bầu cử ID {Id}", userIdClaim, id);
                return StatusCode(403, new { message = "Bạn không có quyền triển khai blockchain cho cuộc bầu cử này." });
            }

            if (cuocBauCu.TrangThaiBlockchain == 2)
            {
                _logger.LogInformation("Cuộc bầu cử ID: {Id} đã được triển khai", id);
                return Ok(new
                {
                    success = true,
                    message = "Cuộc bầu cử đã được triển khai.",
                    blockchainServerId = cuocBauCu.BlockchainServerId,
                    blockchainAddress = cuocBauCu.BlockchainAddress,
                    paymasterUsed = true
                });
            }

            if (cuocBauCu.TrangThaiBlockchain == 1)
            {
                var transaction = await _context.BlockchainTransactions
                    .Where(t => t.DoiTuongId == id && t.LoaiDoiTuong == "CuocBauCu" && t.LoaiGiaoDich == "DEPLOY_SERVER")
                    .OrderByDescending(t => t.NgayTao)
                    .FirstOrDefaultAsync();

                if (transaction != null && transaction.TrangThai == 0)
                {
                    _logger.LogInformation("Cuộc bầu cử ID: {Id} đang trong quá trình triển khai", id);
                    return Ok(new
                    {
                        success = true,
                        message = "Cuộc bầu cử đang trong quá trình triển khai.",
                        transactionHash = transaction.TransactionHash,
                        status = 1,
                        paymasterUsed = true
                    });
                }
            }

            try
            {
                cuocBauCu.TrangThaiBlockchain = 1;
                cuocBauCu.ErrorMessage = null;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Bắt đầu triển khai blockchain cho cuộc bầu cử ID: {Id} với SCW: {SCWAddress}", id, request.SCWAddress);

                var result = await _blockchainServerService.DeployServerForElectionAsync(id, request.SCWAddress);

                if (result.Success)
                {
                    _logger.LogInformation("Đã gửi yêu cầu triển khai thành công cho cuộc bầu cử ID: {Id}, TxHash: {TxHash}", id, result.TransactionHash);

                    return Ok(new
                    {
                        success = true,
                        message = "Đã gửi yêu cầu triển khai thành công. Phí gas sẽ được thanh toán bằng Paymaster sử dụng token HLU.",
                        transactionHash = result.TransactionHash,
                        blockchainAddress = result.BlockchainAddress,
                        status = result.Status,
                        paymasterUsed = true,
                        requiredHLU = "8" // 8 HLU cho factory như trong script
                    });
                }
                else
                {
                    _logger.LogError("Triển khai blockchain thất bại cho cuộc bầu cử ID: {Id}. Lỗi: {Error}", id, result.ErrorMessage);

                    // Cập nhật lại trạng thái khi gặp lỗi
                    cuocBauCu.TrangThaiBlockchain = 3; // Thất bại
                    cuocBauCu.ErrorMessage = result.ErrorMessage;
                    await _context.SaveChangesAsync();

                    return BadRequest(new
                    {
                        success = false,
                        message = result.ErrorMessage ?? "Không thể triển khai server blockchain.",
                        errorCode = "DEPLOY_FAILED"
                    });
                }
            }
            catch (Exception ex)
            {
                cuocBauCu.TrangThaiBlockchain = 3; // Thất bại
                cuocBauCu.ErrorMessage = $"Lỗi khi triển khai: {ex.Message}";
                await _context.SaveChangesAsync();

                _logger.LogError(ex, "Lỗi khi triển khai blockchain cho cuộc bầu cử ID: {Id}", id);

                return StatusCode(500, new
                {
                    success = false,
                    message = $"Có lỗi khi triển khai: {ex.Message}",
                    errorCode = "INTERNAL_ERROR"
                });
            }
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

        /// <summary>
        /// Ghi nhận giao dịch blockchain từ frontend khi sử dụng UserOperation
        /// </summary>
        /// <param name="id">ID của cuộc bầu cử</param>
        /// <param name="request">Thông tin giao dịch</param>
        /// <returns>Trạng thái ghi nhận giao dịch</returns>
        [HttpPost("recordTransaction/{id}")]
        public async Task<IActionResult> RecordTransaction(int id, [FromBody] RecordTransactionRequest request)
        {
            // Kiểm tra tính hợp lệ của request
            if (request == null || string.IsNullOrEmpty(request.TxHash) || string.IsNullOrEmpty(request.ScwAddress))
            {
                return BadRequest(new { success = false, message = "Thiếu thông tin giao dịch hoặc địa chỉ SCW." });
            }

            // Kiểm tra định dạng txHash
            if (!request.TxHash.StartsWith("0x") || request.TxHash.Length != 66)
            {
                _logger.LogWarning("Định dạng hash giao dịch không hợp lệ: {TxHash}, độ dài: {Length}",
                    request.TxHash, request.TxHash.Length);

                // Thử xử lý dù hash không hợp lệ
                if (request.TxHash.StartsWith("0x") && request.TxHash.Length > 10)
                {
                    _logger.LogInformation("Tiếp tục xử lý dù hash không hoàn toàn chuẩn: {TxHash}", request.TxHash);
                }
                else
                {
                    return BadRequest(new { success = false, message = "Định dạng hash giao dịch không hợp lệ." });
                }
            }

            // Tìm cuộc bầu cử
            var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
            if (cuocBauCu == null)
            {
                _logger.LogWarning("Không tìm thấy cuộc bầu cử ID {Id}", id);
                return NotFound(new { success = false, message = "Không tìm thấy cuộc bầu cử." });
            }

            // Kiểm tra quyền của người dùng
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != cuocBauCu.TaiKhoanId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền ghi nhận giao dịch cho cuộc bầu cử ID {Id}", userIdClaim, id);
                return StatusCode(403, new { success = false, message = "Bạn không có quyền ghi nhận giao dịch cho cuộc bầu cử này." });
            }

            try
            {
                // Kiểm tra xem đã có giao dịch DEPLOY_SERVER gần đây chưa
                var existingTransaction = await _context.BlockchainTransactions
                    .Where(t => t.DoiTuongId == id && t.LoaiDoiTuong == "CuocBauCu" && t.LoaiGiaoDich == "DEPLOY_SERVER")
                    .OrderByDescending(t => t.NgayTao)
                    .FirstOrDefaultAsync();

                if (existingTransaction != null && existingTransaction.TrangThai == 1 && cuocBauCu.TrangThaiBlockchain == 2)
                {
                    _logger.LogWarning("Cuộc bầu cử ID {Id} đã có giao dịch triển khai thành công", id);
                    return Ok(new
                    {
                        success = true,
                        message = "Cuộc bầu cử này đã được triển khai thành công.",
                        status = 2,
                        transactionHash = existingTransaction.TransactionHash
                    });
                }

                if (existingTransaction != null && existingTransaction.TransactionHash == request.TxHash)
                {
                    _logger.LogWarning("Giao dịch {TxHash} đã được ghi nhận trước đó", request.TxHash);
                    return Ok(new { success = true, message = "Giao dịch này đã được ghi nhận trước đó." });
                }

                // Tạo bản ghi giao dịch mới
                var transaction = new BlockchainTransaction
                {
                    TransactionHash = request.TxHash,
                    LoaiGiaoDich = "DEPLOY_SERVER",
                    TrangThai = 0, // Pending
                    NgayTao = DateTime.UtcNow,
                    NgayCapNhat = DateTime.UtcNow,
                    BlockNumber = 0, // Chưa có block number
                    DoiTuongId = id,
                    LoaiDoiTuong = "CuocBauCu",
                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        SCWAddress = request.ScwAddress,
                        TenCuocBauCu = cuocBauCu.TenCuocBauCu,
                        ThoiGianKeoDai = (long)(cuocBauCu.NgayKetThuc - cuocBauCu.NgayBatDau).TotalSeconds,
                        MoTa = cuocBauCu.MoTa ?? "Không có mô tả"
                    })
                };

                _context.BlockchainTransactions.Add(transaction);

                // Chỉ cập nhật trạng thái nếu chưa triển khai hoặc đã thất bại
                if (cuocBauCu.TrangThaiBlockchain == 0 || cuocBauCu.TrangThaiBlockchain == 3)
                {
                    _logger.LogInformation("Cập nhật trạng thái blockchain cho cuộc bầu cử ID {Id} sang 'Đang triển khai'", id);
                    cuocBauCu.TrangThaiBlockchain = 1; // Đang triển khai
                    cuocBauCu.BlockchainAddress = request.ScwAddress;
                    cuocBauCu.ErrorMessage = null; // Xóa thông báo lỗi nếu có
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("Đã ghi nhận giao dịch {TxHash} cho cuộc bầu cử ID {Id}", request.TxHash, id);
                return Ok(new
                {
                    success = true,
                    message = "Đã ghi nhận giao dịch thành công",
                    transactionHash = request.TxHash
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi ghi nhận giao dịch cho cuộc bầu cử ID {Id}: {Error}", id, ex.Message);
                return StatusCode(500, new { success = false, message = $"Lỗi khi ghi nhận giao dịch: {ex.Message}" });
            }
        }

        /// <summary>
        /// Đồng bộ trạng thái blockchain cho cuộc bầu cử
        /// </summary>
        /// <param name="id">ID của cuộc bầu cử</param>
        /// <returns>Kết quả đồng bộ</returns>
        // POST: api/CuocBauCu/syncBlockchain/5
        [HttpPost("syncBlockchain/{id}")]
        public async Task<IActionResult> syncBlockchain(int id, [FromBody] object requestObj = null)
        {
            try
            {
                // Khởi tạo các biến mặc định
                bool forceCheck = false;
                string frontendHash = null;
                string backendHash = null;

                // Nếu có dữ liệu request, cố gắng deserialize
                if (requestObj != null)
                {
                    try
                    {
                        var request = System.Text.Json.JsonSerializer.Deserialize<SyncBlockchainRequest>(
                            System.Text.Json.JsonSerializer.Serialize(requestObj),
                            new System.Text.Json.JsonSerializerOptions
                            {
                                PropertyNameCaseInsensitive = true
                            }
                        );

                        if (request != null)
                        {
                            forceCheck = request.ForceCheck;
                            frontendHash = request.FrontendHash;
                            backendHash = request.BackendHash;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi deserialize request body: {Error}", ex.Message);
                        // Tiếp tục với giá trị mặc định
                    }
                }

                _logger.LogInformation("Đồng bộ blockchain cho cuộc bầu cử ID {ID}, forceCheck: {ForceCheck}, " +
                    "frontendHash: {FrontendHash}, backendHash: {BackendHash}",
                    id, forceCheck, frontendHash, backendHash);

                // Kiểm tra cả hai hash nếu được cung cấp
                if (!string.IsNullOrEmpty(frontendHash) || !string.IsNullOrEmpty(backendHash))
                {
                    try
                    {
                        // Tìm giao dịch dựa trên các hash được cung cấp
                        BlockchainTransaction transaction = null;

                        if (!string.IsNullOrEmpty(frontendHash))
                        {
                            transaction = await _context.BlockchainTransactions
                                .FirstOrDefaultAsync(t => t.TransactionHash == frontendHash);
                        }

                        if (transaction == null && !string.IsNullOrEmpty(backendHash))
                        {
                            transaction = await _context.BlockchainTransactions
                                .FirstOrDefaultAsync(t => t.TransactionHash == backendHash);
                        }

                        if (transaction != null && !string.IsNullOrEmpty(transaction.MetaData))
                        {
                            // Tìm actualTxHash trong metadata
                            string actualTxHash = null;
                            try
                            {
                                var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);
                                if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                                {
                                    actualTxHash = txHashElement.GetString();
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Lỗi khi parse metadata: {Error}", ex.Message);
                            }

                            // Nếu tìm thấy actualTxHash, kiểm tra trạng thái giao dịch
                            if (!string.IsNullOrEmpty(actualTxHash) && actualTxHash.StartsWith("0x"))
                            {
                                try
                                {
                                    var web3 = new Web3(_configuration["BlockchainSettings:RpcUrl"]);
                                    var receipt = await web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(actualTxHash);

                                    if (receipt != null)
                                    {
                                        // Cập nhật BlockchainTransaction
                                        transaction.BlockNumber = (long)receipt.BlockNumber.Value;
                                        transaction.TrangThai = receipt.Status.Value == 1 ? 1 : 2; // Success or Failed

                                        // Tìm cuộc bầu cử
                                        var cuocBauCu = await _context.CuocBauCus.FindAsync(id);
                                        if (cuocBauCu != null)
                                        {
                                            if (receipt.Status.Value == 1)
                                            {
                                                cuocBauCu.TrangThaiBlockchain = 2; // Đã triển khai

                                                // Tạo bản ghi DEPLOY_SERVER nếu chưa có
                                                var deployTransaction = await _context.BlockchainTransactions
                                                    .FirstOrDefaultAsync(t => t.DoiTuongId == id &&
                                                                            t.LoaiDoiTuong == "CuocBauCu" &&
                                                                            t.LoaiGiaoDich == "DEPLOY_SERVER");

                                                if (deployTransaction == null)
                                                {
                                                    deployTransaction = new BlockchainTransaction
                                                    {
                                                        TransactionHash = transaction.TransactionHash,
                                                        LoaiGiaoDich = "DEPLOY_SERVER",
                                                        TrangThai = 1, // Success
                                                        NgayTao = transaction.NgayTao,
                                                        NgayCapNhat = DateTime.UtcNow,
                                                        DoiTuongId = id,
                                                        LoaiDoiTuong = "CuocBauCu",
                                                        BlockNumber = (long)receipt.BlockNumber.Value,
                                                        MetaData = System.Text.Json.JsonSerializer.Serialize(new
                                                        {
                                                            userOpHash = transaction.TransactionHash,
                                                            actualTxHash = actualTxHash,
                                                            recovered = true
                                                        })
                                                    };

                                                    _context.BlockchainTransactions.Add(deployTransaction);
                                                }

                                                await _context.SaveChangesAsync();

                                                return Ok(new
                                                {
                                                    success = true,
                                                    message = "Đã đồng bộ blockchain thành công",
                                                    status = cuocBauCu.TrangThaiBlockchain,
                                                    transaction = new
                                                    {
                                                        hash = actualTxHash,
                                                        blockNumber = receipt.BlockNumber.Value.ToString()
                                                    }
                                                });
                                            }
                                            else
                                            {
                                                cuocBauCu.TrangThaiBlockchain = 3; // Thất bại
                                                cuocBauCu.ErrorMessage = "Giao dịch blockchain thất bại";

                                                await _context.SaveChangesAsync();

                                                return Ok(new
                                                {
                                                    success = false,
                                                    message = "Giao dịch thất bại",
                                                    status = cuocBauCu.TrangThaiBlockchain
                                                });
                                            }
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning(ex, "Lỗi khi kiểm tra receipt: {Error}", ex.Message);
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi kiểm tra hash: {Error}", ex.Message);
                    }
                }

                // Nếu không tìm thấy thông tin từ hash hoặc không có hash, sử dụng phương thức kiểm tra truyền thống
                var result = await _blockchainServerService.CheckServerDeploymentStatus(id);

                return Ok(new
                {
                    success = result.Success,
                    message = result.ErrorMessage,
                    status = result.Status
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đồng bộ blockchain: {Error}", ex.Message);
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        [HttpPost("syncAllServerIds")]
        [Authorize]
        public async Task<IActionResult> SyncAllServerIds()
        {
            try
            {
                // Kiểm tra quyền của người dùng (tùy chọn - có thể giới hạn chỉ admin mới được gọi API này)
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return StatusCode(403, new { success = false, message = "Không có quyền thực hiện thao tác này." });
                }

                // Tìm tất cả cuộc bầu cử có địa chỉ blockchain nhưng chưa có ServerId
                var cuocBauCus = await _context.CuocBauCus
                    .Where(c => !string.IsNullOrEmpty(c.BlockchainAddress) &&
                               (c.BlockchainServerId == null || c.BlockchainServerId == 0) &&
                               c.TrangThaiBlockchain == 2) // Chỉ xử lý các cuộc bầu cử đã triển khai thành công
                    .ToListAsync();

                if (!cuocBauCus.Any())
                {
                    return Ok(new { success = true, message = "Không có cuộc bầu cử nào cần đồng bộ ServerId.", count = 0 });
                }

                int successCount = 0;
                int failedCount = 0;
                var results = new List<object>();

                foreach (var cuocBauCu in cuocBauCus)
                {
                    try
                    {
                        // Gọi service để lấy thông tin từ blockchain
                        var blockchainInfo = await _blockchainServerService.GetServerInfoFromBlockchain(cuocBauCu.BlockchainAddress);

                        if (blockchainInfo != null && blockchainInfo.ServerId > 0)
                        {
                            // Cập nhật vào database
                            cuocBauCu.BlockchainServerId = blockchainInfo.ServerId;

                            results.Add(new
                            {
                                id = cuocBauCu.Id,
                                tenCuocBauCu = cuocBauCu.TenCuocBauCu,
                                blockchainAddress = cuocBauCu.BlockchainAddress,
                                serverId = blockchainInfo.ServerId,
                                success = true
                            });

                            successCount++;
                        }
                        else
                        {
                            results.Add(new
                            {
                                id = cuocBauCu.Id,
                                tenCuocBauCu = cuocBauCu.TenCuocBauCu,
                                blockchainAddress = cuocBauCu.BlockchainAddress,
                                success = false,
                                reason = "Không lấy được ServerId từ blockchain"
                            });

                            failedCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi đồng bộ BlockchainServerId cho cuộc bầu cử ID {Id}: {Error}", cuocBauCu.Id, ex.Message);

                        results.Add(new
                        {
                            id = cuocBauCu.Id,
                            tenCuocBauCu = cuocBauCu.TenCuocBauCu,
                            blockchainAddress = cuocBauCu.BlockchainAddress,
                            success = false,
                            reason = $"Lỗi: {ex.Message}"
                        });

                        failedCount++;
                    }
                }

                // Lưu các thay đổi vào database
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Đã đồng bộ thành công {successCount}/{cuocBauCus.Count} cuộc bầu cử.",
                    totalProcessed = cuocBauCus.Count,
                    successCount = successCount,
                    failedCount = failedCount,
                    details = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đồng bộ tất cả BlockchainServerId: {Error}", ex.Message);

                return StatusCode(500, new
                {
                    success = false,
                    message = $"Có lỗi xảy ra khi đồng bộ: {ex.Message}"
                });
            }
        }
      

        [HttpPost("syncByNameForCreator/{creatorAddress}")]
        public async Task<IActionResult> SyncByNameForCreator(string creatorAddress)
        {
            try
            {
                if (!creatorAddress.StartsWith("0x") || creatorAddress.Length != 42)
                {
                    return BadRequest(new { success = false, message = "Địa chỉ người tạo không hợp lệ" });
                }

                int syncCount = await _blockchainServerService.SyncServerIdsByElectionName(creatorAddress);

                return Ok(new
                {
                    success = true,
                    message = $"Đã đồng bộ thành công {syncCount} cuộc bầu cử dựa trên tên.",
                    syncCount = syncCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đồng bộ theo tên cho người tạo {CreatorAddress}: {Error}",
                    creatorAddress, ex.Message);

                return BadRequest(new
                {
                    success = false,
                    message = $"Có lỗi xảy ra: {ex.Message}"
                });
            }
        }

        [HttpPost("deployBlockchainWithCallData/{id}")]
        public async Task<IActionResult> DeployBlockchainWithCallData(int id, [FromBody] DeployWithCallDataRequest request)
        {
            if (string.IsNullOrEmpty(request.ScwAddress) || string.IsNullOrEmpty(request.CallData))
            {
                return BadRequest("SCW address và callData không được để trống");
            }

            try
            {
                _logger.LogInformation("Bắt đầu triển khai blockchain với callData được cung cấp cho cuộc bầu cử ID: {Id} với SCW: {ScwAddress}",
                    id, request.ScwAddress);

                var result = await _blockchainServerService.DeployServerWithCallDataAsync(id, request.ScwAddress, request.CallData);

                if (result.Success)
                {
                    return Ok(result);
                }
                else
                {
                    _logger.LogError("Triển khai blockchain thất bại cho cuộc bầu cử ID: {Id}. Lỗi: {Error}",
                        id, result.ErrorMessage);
                    return BadRequest(result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi triển khai blockchain cho cuộc bầu cử ID: {Id}", id);
                return BadRequest(new { Success = false, ErrorMessage = ex.Message });
            }
        }

        [HttpPost("updateAllContractAddresses")]
        public async Task<IActionResult> UpdateAllContractAddresses()
        {
            try
            {
                // Lấy danh sách cuộc bầu cử cần cập nhật
                var elections = await _context.CuocBauCus
                    .Where(c => c.BlockchainServerId > 0)
                    .ToListAsync();

                int updatedCount = 0;
                var results = new List<object>();

                // Duyệt qua từng cuộc bầu cử để cập nhật
                foreach (var election in elections)
                {
                    if (election.BlockchainServerId == null || election.BlockchainServerId <= 0)
                        continue;

                    try
                    {
                        // Lấy thông tin server từ blockchain
                        var layThongTinServerFunction = _blockchainService.GetFactoryFunction("layThongTinServer");
                        if (layThongTinServerFunction == null)
                        {
                            _logger.LogError("Không thể lấy hàm layThongTinServer từ Factory contract");
                            continue;
                        }

                        // Lấy địa chỉ factory từ cấu hình
                        string factoryAddress = _configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
                        if (string.IsNullOrEmpty(factoryAddress))
                        {
                            _logger.LogError("Địa chỉ factory không được cấu hình trong appsettings.json");
                            continue;
                        }

                        // Tạo Web3 instance và gọi hàm
                        var web3 = new Web3(_configuration["BlockchainSettings:RpcUrl"]);

                        // Gọi hàm và lấy kết quả trực tiếp là địa chỉ đầu tiên của tuple 
                        var contractAddress = await layThongTinServerFunction.CallAsync<string>((int)election.BlockchainServerId);

                        if (!string.IsNullOrEmpty(contractAddress))
                        {
                            // Lưu địa chỉ contract cũ để so sánh
                            string oldAddress = election.BlockchainAddress;

                            // Cập nhật địa chỉ contract mới
                            election.BlockchainAddress = contractAddress;
                            _logger.LogInformation("Địa chỉ contract mới: {Address}", contractAddress);

                            results.Add(new
                            {
                                id = election.Id,
                                name = election.TenCuocBauCu,
                                serverId = election.BlockchainServerId,
                                oldAddress,
                                newAddress = contractAddress
                            });

                            updatedCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi cập nhật địa chỉ contract cho ID {ID}: {Error}",
                            election.Id, ex.Message);
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Đã cập nhật {updatedCount}/{elections.Count} địa chỉ contract",
                    details = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật tất cả địa chỉ contract: {Error}", ex.Message);
                return BadRequest(new { success = false, message = ex.Message });
            }
        }




        public class DeployWithCallDataRequest
        {
            public string ScwAddress { get; set; }
            public string CallData { get; set; }
        }
    }

    // Định nghĩa lớp để map dữ liệu trả về
    public class ServerInfo
    {
        [Parameter("address", "quanLyCuocBauCu")]
        public string QuanLyCuocBauCu { get; set; }

        [Parameter("string", "tenCuocBauCu")]
        public string TenCuocBauCu { get; set; }

        [Parameter("string", "moTa")]
        public string MoTa { get; set; }

        [Parameter("uint8", "trangThai")]
        public byte TrangThai { get; set; }

        [Parameter("uint64", "soLuongBaoCao")]
        public ulong SoLuongBaoCao { get; set; }

        [Parameter("uint64", "soLuongViPhamXacNhan")]
        public ulong SoLuongViPhamXacNhan { get; set; }

        [Parameter("address", "nguoiTao")]
        public string NguoiTao { get; set; }
    }

    public class DeployBlockchainRequest
    {
        public string SCWAddress { get; set; }
    }

    public class RecordTransactionRequest
    {
        public string TxHash { get; set; }
        public string ScwAddress { get; set; }
    }

    public class SyncBlockchainRequest
    {
        // Thêm JsonPropertyName để đảm bảo mapping chính xác
        [System.Text.Json.Serialization.JsonPropertyName("forceCheck")]
        public bool ForceCheck { get; set; } = false; // Giá trị mặc định

        [System.Text.Json.Serialization.JsonPropertyName("frontendHash")]
        public string FrontendHash { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("backendHash")]
        public string BackendHash { get; set; }
    }

}