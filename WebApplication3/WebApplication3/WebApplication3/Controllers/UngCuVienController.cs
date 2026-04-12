using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using WebApplication3.Data;
using WebApplication3.Models;
using WebApplication3.Services;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UngCuVienController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<UngCuVienController> _logger;
        private readonly IAzureBlobService _azureBlobService;
        private readonly IBlockchainLookupService _blockchainLookupService;

        public UngCuVienController(
            ApplicationDbContext context,
            ILogger<UngCuVienController> logger,
            IAzureBlobService azureBlobService,
            IBlockchainLookupService blockchainLookupService = null) // Cho phép null để tương thích với code cũ
        {
            _context = context;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _azureBlobService = azureBlobService ?? throw new ArgumentNullException(nameof(azureBlobService));
            _blockchainLookupService = blockchainLookupService; // Có thể null nếu không sử dụng blockchain
        }

        #region Các API Get cơ bản

        [HttpGet]
        public async Task<ActionResult<IEnumerable<UngCuVienDTO>>> GetUngCuViens()
        {
            return await _context.UngCuViens
                .Select(u => new UngCuVienDTO
                {
                    Id = u.Id,
                    HoTen = u.HoTen,
                    Anh = u.Anh,
                    MoTa = u.MoTa,
                    ViTriUngCuId = u.ViTriUngCuId,
                    CuocBauCuId = u.CuocBauCuId,
                    PhienBauCuId = u.PhienBauCuId,
                    TaiKhoanId = u.TaiKhoanId,
                    CuTriId = u.CuTriId
                })
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UngCuVienDTO>> GetUngCuVien(int id)
        {
            var ungCuVien = await _context.UngCuViens.FindAsync(id);

            if (ungCuVien == null)
            {
                return NotFound();
            }

            return new UngCuVienDTO
            {
                Id = ungCuVien.Id,
                HoTen = ungCuVien.HoTen,
                Anh = ungCuVien.Anh,
                MoTa = ungCuVien.MoTa,
                ViTriUngCuId = ungCuVien.ViTriUngCuId,
                CuocBauCuId = ungCuVien.CuocBauCuId,
                PhienBauCuId = ungCuVien.PhienBauCuId,
                TaiKhoanId = ungCuVien.TaiKhoanId,
                CuTriId = ungCuVien.CuTriId
            };
        }

        [HttpGet("detail/{id}")]
        public async Task<ActionResult<UngCuVienDetailDTO>> GetUngCuVienDetail(int id)
        {
            var ungCuVien = await _context.UngCuViens
                .Include(u => u.ViTriUngCu)
                .Include(u => u.CuocBauCu)
                .Include(u => u.PhienBauCu)
                .Include(u => u.TaiKhoan)
                .Include(u => u.CuTri)
                .ThenInclude(c => c.TaiKhoan)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (ungCuVien == null)
            {
                return NotFound();
            }

            // Tạo URL có SAS token nếu có ảnh
            string anhUrl = null;
            if (!string.IsNullOrEmpty(ungCuVien.Anh))
            {
                bool blobExists = await _azureBlobService.BlobExistsAsync(ungCuVien.Anh);
                if (blobExists)
                {
                    anhUrl = _azureBlobService.GenerateSasToken(ungCuVien.Anh, 60);
                }
            }

            // Lấy địa chỉ ví blockchain của ứng viên (nếu có BlockchainLookupService)
            string diaChiVi = null;
            if (_blockchainLookupService != null)
            {
                diaChiVi = await _blockchainLookupService.GetCandidateBlockchainAddress(ungCuVien.Id);
            }

            return new UngCuVienDetailDTO
            {
                Id = ungCuVien.Id,
                HoTen = ungCuVien.HoTen,
                Anh = ungCuVien.Anh,
                AnhUrl = anhUrl,
                MoTa = ungCuVien.MoTa,
                ViTriUngCuId = ungCuVien.ViTriUngCuId,
                TenViTriUngCu = ungCuVien.ViTriUngCu?.TenViTriUngCu,
                CuocBauCuId = ungCuVien.CuocBauCuId,
                TenCuocBauCu = ungCuVien.CuocBauCu?.TenCuocBauCu,
                PhienBauCuId = ungCuVien.PhienBauCuId,
                TenPhienBauCu = ungCuVien.PhienBauCu?.TenPhienBauCu,
                TaiKhoanId = ungCuVien.TaiKhoanId,
                TenTaiKhoan = ungCuVien.TaiKhoan?.TenDangNhap ?? ungCuVien.CuTri?.TaiKhoan?.TenDangNhap,
                CuTriId = ungCuVien.CuTriId,
                EmailCuTri = ungCuVien.CuTri?.Email,
                DiaChiVi = diaChiVi
            };
        }

        [HttpGet("phienbaucu/{phienBauCuId}")]
        public async Task<ActionResult<IEnumerable<UngCuVienDTO>>> GetUngCuViensByPhienBauCuId(int phienBauCuId)
        {
            return await _context.UngCuViens
                .Where(u => u.PhienBauCuId == phienBauCuId)
                .Select(u => new UngCuVienDTO
                {
                    Id = u.Id,
                    HoTen = u.HoTen,
                    Anh = u.Anh,
                    MoTa = u.MoTa,
                    ViTriUngCuId = u.ViTriUngCuId,
                    CuocBauCuId = u.CuocBauCuId,
                    PhienBauCuId = u.PhienBauCuId,
                    TaiKhoanId = u.TaiKhoanId,
                    CuTriId = u.CuTriId
                })
                .ToListAsync();
        }

        [HttpGet("cuocbaucu/{cuocBauCuId}")]
        public async Task<ActionResult<IEnumerable<UngCuVienDTO>>> GetUngCuViensByCuocBauCuId(int cuocBauCuId)
        {
            return await _context.UngCuViens
                .Where(u => u.CuocBauCuId == cuocBauCuId)
                .Select(u => new UngCuVienDTO
                {
                    Id = u.Id,
                    HoTen = u.HoTen,
                    Anh = u.Anh,
                    MoTa = u.MoTa,
                    ViTriUngCuId = u.ViTriUngCuId,
                    CuocBauCuId = u.CuocBauCuId,
                    PhienBauCuId = u.PhienBauCuId,
                    TaiKhoanId = u.TaiKhoanId,
                    CuTriId = u.CuTriId
                })
                .ToListAsync();
        }

        [HttpGet("tenphienbaucu/{tenPhienBauCu}")]
        public async Task<ActionResult<IEnumerable<UngCuVienDTO>>> GetUngCuViensByTenPhienBauCu(string tenPhienBauCu)
        {
            return await _context.UngCuViens
                .Where(u => u.PhienBauCu.TenPhienBauCu == tenPhienBauCu)
                .Select(u => new UngCuVienDTO
                {
                    Id = u.Id,
                    HoTen = u.HoTen,
                    Anh = u.Anh,
                    MoTa = u.MoTa,
                    ViTriUngCuId = u.ViTriUngCuId,
                    CuocBauCuId = u.CuocBauCuId,
                    PhienBauCuId = u.PhienBauCuId,
                    TaiKhoanId = u.TaiKhoanId,
                    CuTriId = u.CuTriId
                })
                .ToListAsync();
        }

        [HttpGet("tencuocbaucu/{tenCuocBauCu}")]
        public async Task<ActionResult<IEnumerable<UngCuVienDTO>>> GetUngCuViensByTenCuocBauCu(string tenCuocBauCu)
        {
            return await _context.UngCuViens
                .Where(u => u.CuocBauCu.TenCuocBauCu == tenCuocBauCu)
                .Select(u => new UngCuVienDTO
                {
                    Id = u.Id,
                    HoTen = u.HoTen,
                    Anh = u.Anh,
                    MoTa = u.MoTa,
                    ViTriUngCuId = u.ViTriUngCuId,
                    CuocBauCuId = u.CuocBauCuId,
                    PhienBauCuId = u.PhienBauCuId,
                    TaiKhoanId = u.TaiKhoanId,
                    CuTriId = u.CuTriId
                })
                .ToListAsync();
        }

        [HttpGet("vitriungcu/{viTriUngCuId}")]
        public async Task<ActionResult<IEnumerable<UngCuVienDTO>>> GetUngCuViensByViTriUngCuId(int viTriUngCuId)
        {
            try
            {
                var ungCuViens = await _context.UngCuViens
                    .Where(u => u.ViTriUngCuId == viTriUngCuId)
                    .Select(u => new UngCuVienDTO
                    {
                        Id = u.Id,
                        HoTen = u.HoTen,
                        Anh = u.Anh,
                        MoTa = u.MoTa,
                        ViTriUngCuId = u.ViTriUngCuId,
                        CuocBauCuId = u.CuocBauCuId,
                        PhienBauCuId = u.PhienBauCuId,
                        TaiKhoanId = u.TaiKhoanId,
                        CuTriId = u.CuTriId
                    })
                    .ToListAsync();

                return Ok(ungCuViens);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách ứng viên theo vị trí ứng cử ID: {Id}", viTriUngCuId);
                return StatusCode(500, new { success = false, message = $"Có lỗi xảy ra: {ex.Message}" });
            }
        }

        // API mới: Lấy ứng viên theo CuTriId
        [HttpGet("cutri/{cuTriId}")]
        public async Task<ActionResult<UngCuVienDTO>> GetUngCuVienByCuTriId(int cuTriId)
        {
            var ungCuVien = await _context.UngCuViens
                .FirstOrDefaultAsync(u => u.CuTriId == cuTriId);

            if (ungCuVien == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy ứng viên cho cử tri này" });
            }

            return new UngCuVienDTO
            {
                Id = ungCuVien.Id,
                HoTen = ungCuVien.HoTen,
                Anh = ungCuVien.Anh,
                MoTa = ungCuVien.MoTa,
                ViTriUngCuId = ungCuVien.ViTriUngCuId,
                CuocBauCuId = ungCuVien.CuocBauCuId,
                PhienBauCuId = ungCuVien.PhienBauCuId,
                TaiKhoanId = ungCuVien.TaiKhoanId,
                CuTriId = ungCuVien.CuTriId
            };
        }

        #endregion

        #region API cho Blockchain

        // API kiểm tra cử tri đã đăng ký làm ứng viên chưa
        [HttpGet("check-candidate/{cuTriId}")]
        public async Task<ActionResult<bool>> CheckIsCandidate(int cuTriId)
        {
            var isCandidate = await _context.UngCuViens.AnyAsync(u => u.CuTriId == cuTriId);
            return Ok(new { isCandidate });
        }

        // API kiểm tra tài khoản đã đăng ký làm ứng viên trong phiên bầu cử chưa
        [HttpGet("check-account-candidate/{taiKhoanId}/{phienBauCuId}")]
        public async Task<ActionResult<bool>> CheckAccountIsCandidate(int taiKhoanId, int phienBauCuId)
        {
            // Kiểm tra trực tiếp qua TaiKhoanId
            var directCandidate = await _context.UngCuViens.AnyAsync(u =>
                u.TaiKhoanId == taiKhoanId && u.PhienBauCuId == phienBauCuId);

            if (directCandidate)
            {
                return Ok(new { isCandidate = true });
            }

            // Kiểm tra gián tiếp qua CuTriId
            var cuTri = await _context.CuTris.FirstOrDefaultAsync(c =>
                c.TaiKhoanId == taiKhoanId && c.PhienBauCuId == phienBauCuId);

            if (cuTri != null)
            {
                var indirectCandidate = await _context.UngCuViens.AnyAsync(u => u.CuTriId == cuTri.Id);
                return Ok(new { isCandidate = indirectCandidate });
            }

            return Ok(new { isCandidate = false });
        }

        // API blockchain: Lấy địa chỉ ví của ứng viên
        [HttpGet("blockchain-address/{id}")]
        public async Task<ActionResult<string>> GetBlockchainAddress(int id)
        {
            if (_blockchainLookupService == null)
            {
                return NotFound(new { success = false, message = "Dịch vụ blockchain không khả dụng" });
            }

            try
            {
                var address = await _blockchainLookupService.GetCandidateBlockchainAddress(id);

                if (string.IsNullOrEmpty(address))
                {
                    return NotFound(new { success = false, message = "Không tìm thấy địa chỉ blockchain cho ứng viên này" });
                }

                return Ok(new { success = true, blockchainAddress = address });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy địa chỉ blockchain của ứng viên ID: {Id}", id);
                return StatusCode(500, new { success = false, message = $"Đã xảy ra lỗi: {ex.Message}" });
            }
        }

        #endregion

        #region API tạo và cập nhật ứng viên

        [HttpPost]
        public async Task<ActionResult<UngCuVienDTO>> PostUngCuVien(UngCuVienDTO ungCuVienDTO)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Kiểm tra xem ứng viên có là cử tri không
                if (!ungCuVienDTO.CuTriId.HasValue && ungCuVienDTO.TaiKhoanId.HasValue)
                {
                    // Tìm cử tri có cùng TaiKhoanId và trong cùng phiên bầu cử
                    var cuTri = await _context.CuTris.FirstOrDefaultAsync(c =>
                        c.TaiKhoanId == ungCuVienDTO.TaiKhoanId &&
                        c.PhienBauCuId == ungCuVienDTO.PhienBauCuId &&
                        c.CuocBauCuId == ungCuVienDTO.CuocBauCuId);

                    if (cuTri == null)
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Ứng viên phải là cử tri trước khi đăng ký. Vui lòng thêm người này vào danh sách cử tri trước."
                        });
                    }

                    ungCuVienDTO.CuTriId = cuTri.Id;
                }
                else if (!ungCuVienDTO.CuTriId.HasValue && !ungCuVienDTO.TaiKhoanId.HasValue)
                {
                    // Cho phép tạo ứng viên không liên kết cho tương thích ngược
                    _logger.LogWarning("Tạo ứng viên không có CuTriId hoặc TaiKhoanId");
                }

                // Kiểm tra xem đã có ứng viên với cùng CuTriId chưa (nếu có CuTriId)
                if (ungCuVienDTO.CuTriId.HasValue)
                {
                    var existingByVoter = await _context.UngCuViens.FirstOrDefaultAsync(u =>
                        u.CuTriId == ungCuVienDTO.CuTriId &&
                        u.PhienBauCuId == ungCuVienDTO.PhienBauCuId);

                    if (existingByVoter != null)
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Cử tri này đã đăng ký làm ứng viên trong phiên bầu cử này"
                        });
                    }
                }

                var ungCuVien = new UngCuVien
                {
                    HoTen = ungCuVienDTO.HoTen,
                    Anh = ungCuVienDTO.Anh,
                    MoTa = ungCuVienDTO.MoTa,
                    ViTriUngCuId = ungCuVienDTO.ViTriUngCuId,
                    CuocBauCuId = ungCuVienDTO.CuocBauCuId,
                    PhienBauCuId = ungCuVienDTO.PhienBauCuId,
                    TaiKhoanId = ungCuVienDTO.TaiKhoanId,
                    CuTriId = ungCuVienDTO.CuTriId
                };

                _context.UngCuViens.Add(ungCuVien);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                ungCuVienDTO.Id = ungCuVien.Id;
                return CreatedAtAction(nameof(GetUngCuVien), new { id = ungCuVien.Id }, ungCuVienDTO);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi thêm ứng viên");
                return StatusCode(500, new { success = false, message = $"Có lỗi xảy ra: {ex.Message}" });
            }
        }

        // API đăng ký ứng viên từ tài khoản
        [HttpPost("register-from-account")]
        public async Task<ActionResult<UngCuVienDTO>> RegisterFromAccount(UngCuVienDTO ungCuVienDTO)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                if (!ungCuVienDTO.TaiKhoanId.HasValue)
                {
                    return BadRequest(new { success = false, message = "Cần cung cấp ID tài khoản" });
                }

                // Kiểm tra tài khoản có tồn tại không
                var taiKhoan = await _context.TaiKhoan.FindAsync(ungCuVienDTO.TaiKhoanId);
                if (taiKhoan == null)
                {
                    return BadRequest(new { success = false, message = "Không tìm thấy tài khoản" });
                }

                // Tìm cử tri có cùng TaiKhoanId và trong cùng phiên bầu cử
                var cuTri = await _context.CuTris.FirstOrDefaultAsync(c =>
                    c.TaiKhoanId == ungCuVienDTO.TaiKhoanId &&
                    c.PhienBauCuId == ungCuVienDTO.PhienBauCuId &&
                    c.CuocBauCuId == ungCuVienDTO.CuocBauCuId);

                if (cuTri == null)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Người dùng này chưa là cử tri trong phiên bầu cử này. Vui lòng thêm vào danh sách cử tri trước."
                    });
                }

                // Kiểm tra xem đã có ứng viên với cùng CuTriId chưa
                var existingByVoter = await _context.UngCuViens.FirstOrDefaultAsync(u =>
                    u.CuTriId == cuTri.Id);

                if (existingByVoter != null)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Cử tri này đã đăng ký làm ứng viên trong phiên bầu cử này"
                    });
                }

                var ungCuVien = new UngCuVien
                {
                    HoTen = ungCuVienDTO.HoTen ?? taiKhoan.TenHienThi,
                    Anh = ungCuVienDTO.Anh,
                    MoTa = ungCuVienDTO.MoTa,
                    ViTriUngCuId = ungCuVienDTO.ViTriUngCuId,
                    CuocBauCuId = ungCuVienDTO.CuocBauCuId,
                    PhienBauCuId = ungCuVienDTO.PhienBauCuId,
                    TaiKhoanId = ungCuVienDTO.TaiKhoanId,
                    CuTriId = cuTri.Id
                };

                _context.UngCuViens.Add(ungCuVien);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                ungCuVienDTO.Id = ungCuVien.Id;
                ungCuVienDTO.CuTriId = cuTri.Id;
                return CreatedAtAction(nameof(GetUngCuVien), new { id = ungCuVien.Id }, ungCuVienDTO);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi đăng ký ứng viên từ tài khoản");
                return StatusCode(500, new { success = false, message = $"Đã xảy ra lỗi: {ex.Message}" });
            }
        }

        // API mới: Đăng ký ứng viên và đồng thời tự động tạo cử tri nếu chưa có
        [HttpPost("register-with-voter")]
        public async Task<ActionResult<UngCuVienDTO>> RegisterWithVoter(UngVienRegistrationDTO registrationDTO)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                if (!registrationDTO.TaiKhoanId.HasValue)
                {
                    return BadRequest(new { success = false, message = "Cần cung cấp ID tài khoản" });
                }

                // Kiểm tra tài khoản có tồn tại không
                var taiKhoan = await _context.TaiKhoan.FindAsync(registrationDTO.TaiKhoanId);
                if (taiKhoan == null)
                {
                    return BadRequest(new { success = false, message = "Không tìm thấy tài khoản" });
                }

                // Tìm cử tri có cùng TaiKhoanId và trong cùng phiên bầu cử
                var cuTri = await _context.CuTris.FirstOrDefaultAsync(c =>
                    c.TaiKhoanId == registrationDTO.TaiKhoanId &&
                    c.PhienBauCuId == registrationDTO.PhienBauCuId &&
                    c.CuocBauCuId == registrationDTO.CuocBauCuId);

                // Nếu chưa có cử tri, tạo mới
                if (cuTri == null)
                {
                    // Kiểm tra thông tin cử tri đã được cung cấp chưa
                    if (string.IsNullOrWhiteSpace(registrationDTO.Email) || string.IsNullOrWhiteSpace(registrationDTO.Sdt))
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Cần cung cấp Email và Số điện thoại để tạo cử tri mới"
                        });
                    }

                    // Tạo cử tri mới
                    cuTri = new CuTri
                    {
                        TaiKhoanId = registrationDTO.TaiKhoanId.Value,
                        CuocBauCuId = registrationDTO.CuocBauCuId,
                        PhienBauCuId = registrationDTO.PhienBauCuId,
                        Email = registrationDTO.Email,
                        Sdt = registrationDTO.Sdt,
                        XacMinh = true, // Mặc định đã xác minh vì đã đăng nhập
                        BoPhieu = false,
                        SoLanGuiOtp = 0
                    };

                    _context.CuTris.Add(cuTri);
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("Đã tạo cử tri mới với ID {CuTriId} cho tài khoản {TaiKhoanId}",
                        cuTri.Id, registrationDTO.TaiKhoanId);
                }

                // Kiểm tra xem đã có ứng viên với cùng CuTriId chưa
                var existingByVoter = await _context.UngCuViens.FirstOrDefaultAsync(u =>
                    u.CuTriId == cuTri.Id);

                if (existingByVoter != null)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Cử tri này đã đăng ký làm ứng viên trong phiên bầu cử này"
                    });
                }

                // Tạo ứng viên mới
                var ungCuVien = new UngCuVien
                {
                    HoTen = registrationDTO.HoTen ?? taiKhoan.TenHienThi,
                    Anh = registrationDTO.Anh,
                    MoTa = registrationDTO.MoTa,
                    ViTriUngCuId = registrationDTO.ViTriUngCuId,
                    CuocBauCuId = registrationDTO.CuocBauCuId,
                    PhienBauCuId = registrationDTO.PhienBauCuId,
                    TaiKhoanId = registrationDTO.TaiKhoanId,
                    CuTriId = cuTri.Id
                };

                _context.UngCuViens.Add(ungCuVien);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                var result = new UngCuVienDTO
                {
                    Id = ungCuVien.Id,
                    HoTen = ungCuVien.HoTen,
                    Anh = ungCuVien.Anh,
                    MoTa = ungCuVien.MoTa,
                    ViTriUngCuId = ungCuVien.ViTriUngCuId,
                    CuocBauCuId = ungCuVien.CuocBauCuId,
                    PhienBauCuId = ungCuVien.PhienBauCuId,
                    TaiKhoanId = ungCuVien.TaiKhoanId,
                    CuTriId = ungCuVien.CuTriId
                };

                return CreatedAtAction(nameof(GetUngCuVien), new { id = ungCuVien.Id }, result);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi đăng ký ứng viên và cử tri");
                return StatusCode(500, new { success = false, message = $"Đã xảy ra lỗi: {ex.Message}" });
            }
        }

        [HttpPost("bulk")]
        public async Task<IActionResult> PostUngCuViens([FromBody] List<UngCuVienDTO> ungCuVienDTOs)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Lọc ra các CuTriId
                var cuTriIds = ungCuVienDTOs
                    .Where(u => u.CuTriId.HasValue)
                    .Select(u => u.CuTriId.Value)
                    .Distinct()
                    .ToList();

                // Kiểm tra các CuTriId có tồn tại không
                if (cuTriIds.Any())
                {
                    var existingCuTriIds = await _context.CuTris
                        .Where(c => cuTriIds.Contains(c.Id))
                        .Select(c => c.Id)
                        .ToListAsync();

                    var missingCuTriIds = cuTriIds.Except(existingCuTriIds).ToList();
                    if (missingCuTriIds.Any())
                    {
                        return BadRequest(new
                        {
                            success = false,
                            message = "Một số CuTriId không tồn tại",
                            missingIds = missingCuTriIds
                        });
                    }
                }

                // Kiểm tra trùng lặp ứng viên
                foreach (var dto in ungCuVienDTOs)
                {
                    if (dto.CuTriId.HasValue)
                    {
                        var existingUngVien = await _context.UngCuViens
                            .FirstOrDefaultAsync(u => u.CuTriId == dto.CuTriId && u.PhienBauCuId == dto.PhienBauCuId);

                        if (existingUngVien != null)
                        {
                            return BadRequest(new
                            {
                                success = false,
                                message = $"Cử tri với ID {dto.CuTriId} đã đăng ký làm ứng viên trong phiên bầu cử này"
                            });
                        }
                    }
                }

                var ungCuViens = ungCuVienDTOs.Select(u => new UngCuVien
                {
                    HoTen = u.HoTen,
                    Anh = u.Anh,
                    MoTa = u.MoTa,
                    ViTriUngCuId = u.ViTriUngCuId,
                    CuocBauCuId = u.CuocBauCuId,
                    PhienBauCuId = u.PhienBauCuId,
                    TaiKhoanId = u.TaiKhoanId,
                    CuTriId = u.CuTriId
                }).ToList();

                _context.UngCuViens.AddRange(ungCuViens);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new { success = true, message = "Thêm nhiều ứng viên thành công" });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Lỗi khi thêm nhiều ứng viên");
                return StatusCode(500, new { success = false, message = $"Có lỗi xảy ra: {ex.Message}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutUngCuVien(int id, UngCuVienDTO ungCuVienDTO)
        {
            if (id != ungCuVienDTO.Id)
            {
                return BadRequest();
            }

            var ungCuVien = await _context.UngCuViens.FindAsync(id);
            if (ungCuVien == null)
            {
                return NotFound();
            }

            // Giữ nguyên liên kết CuTriId hiện tại nếu không được cung cấp
            if (!ungCuVienDTO.CuTriId.HasValue)
            {
                ungCuVienDTO.CuTriId = ungCuVien.CuTriId;
            }

            // Giữ nguyên liên kết TaiKhoanId hiện tại nếu không được cung cấp
            if (!ungCuVienDTO.TaiKhoanId.HasValue)
            {
                ungCuVienDTO.TaiKhoanId = ungCuVien.TaiKhoanId;
            }

            ungCuVien.HoTen = ungCuVienDTO.HoTen;
            ungCuVien.Anh = ungCuVienDTO.Anh;
            ungCuVien.MoTa = ungCuVienDTO.MoTa;
            ungCuVien.ViTriUngCuId = ungCuVienDTO.ViTriUngCuId;
            ungCuVien.CuocBauCuId = ungCuVienDTO.CuocBauCuId;
            ungCuVien.PhienBauCuId = ungCuVienDTO.PhienBauCuId;
            ungCuVien.TaiKhoanId = ungCuVienDTO.TaiKhoanId;
            ungCuVien.CuTriId = ungCuVienDTO.CuTriId;

            _context.Entry(ungCuVien).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPut("bulk")]
        public async Task<IActionResult> PutUngCuViens([FromBody] List<UngCuVienDTO> ungCuVienDTOs)
        {
            var ungCuVienIds = ungCuVienDTOs.Select(u => u.Id).ToList();
            var ungCuViens = await _context.UngCuViens.Where(u => ungCuVienIds.Contains(u.Id)).ToListAsync();

            foreach (var ungCuVien in ungCuViens)
            {
                var ungCuVienDTO = ungCuVienDTOs.First(u => u.Id == ungCuVien.Id);
                ungCuVien.HoTen = ungCuVienDTO.HoTen;
                ungCuVien.Anh = ungCuVienDTO.Anh;
                ungCuVien.MoTa = ungCuVienDTO.MoTa;
                ungCuVien.ViTriUngCuId = ungCuVienDTO.ViTriUngCuId;
                ungCuVien.CuocBauCuId = ungCuVienDTO.CuocBauCuId;
                ungCuVien.PhienBauCuId = ungCuVienDTO.PhienBauCuId;
                ungCuVien.TaiKhoanId = ungCuVienDTO.TaiKhoanId ?? ungCuVien.TaiKhoanId;
                ungCuVien.CuTriId = ungCuVienDTO.CuTriId ?? ungCuVien.CuTriId;
            }

            _context.UngCuViens.UpdateRange(ungCuViens);
            await _context.SaveChangesAsync();

            return Ok();
        }

        #endregion

        #region API xóa ứng viên

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUngCuVien(int id)
        {
            var ungCuVien = await _context.UngCuViens.FindAsync(id);
            if (ungCuVien == null)
            {
                return NotFound();
            }

            _context.UngCuViens.Remove(ungCuVien);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("phienbaucu/{phienBauCuId}")]
        public async Task<IActionResult> DeleteUngCuViensByPhienBauCuId(int phienBauCuId)
        {
            var ungCuViens = await _context.UngCuViens.Where(u => u.PhienBauCuId == phienBauCuId).ToListAsync();
            if (!ungCuViens.Any())
            {
                return NotFound();
            }

            _context.UngCuViens.RemoveRange(ungCuViens);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("cuocbaucu/{cuocBauCuId}")]
        public async Task<IActionResult> DeleteUngCuViensByCuocBauCuId(int cuocBauCuId)
        {
            var ungCuViens = await _context.UngCuViens.Where(u => u.CuocBauCuId == cuocBauCuId).ToListAsync();
            if (!ungCuViens.Any())
            {
                return NotFound();
            }

            _context.UngCuViens.RemoveRange(ungCuViens);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("multiple")]
        public async Task<IActionResult> DeleteUngCuViensByIds([FromBody] List<int> ids)
        {
            var ungCuViens = await _context.UngCuViens.Where(u => ids.Contains(u.Id)).ToListAsync();
            if (!ungCuViens.Any())
            {
                return NotFound();
            }

            _context.UngCuViens.RemoveRange(ungCuViens);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        #endregion

        #region API quản lý hình ảnh

        // API: Upload ảnh cho ứng cử viên
        [HttpPost("uploadImage/{id}")]
        public async Task<IActionResult> UploadImage(int id, IFormFile imageFile)
        {
            _logger.LogInformation("Bắt đầu upload ảnh cho ứng cử viên ID: {Id}", id);

            if (imageFile == null || imageFile.Length == 0)
            {
                _logger.LogWarning("File ảnh không hợp lệ cho ứng cử viên ID: {Id}", id);
                return BadRequest(new { success = false, message = "File ảnh không hợp lệ." });
            }

            var ungCuVien = await _context.UngCuViens
                .Include(u => u.CuocBauCu) // Đảm bảo include để kiểm tra quyền
                .FirstOrDefaultAsync(u => u.Id == id);

            if (ungCuVien == null)
            {
                _logger.LogWarning("Không tìm thấy ứng cử viên ID: {Id}", id);
                return NotFound(new { success = false, message = "Không tìm thấy ứng cử viên." });
            }

            // Kiểm tra quyền
            var userIdClaim = User.FindFirst("UserID")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                _logger.LogWarning("Người dùng không xác định khi upload ảnh cho ứng cử viên ID: {Id}", id);
                return StatusCode(403, new { success = false, message = "Bạn không có quyền tải ảnh cho ứng cử viên này." });
            }

            // Kiểm tra quyền quản lý cuộc bầu cử
            if (ungCuVien.CuocBauCu == null || ungCuVien.CuocBauCu.TaiKhoanId != userId)
            {
                _logger.LogWarning("Người dùng {UserId} không có quyền upload ảnh cho ứng cử viên ID: {Id}", userId, id);
                return StatusCode(403, new { success = false, message = "Bạn không có quyền tải ảnh cho ứng cử viên này." });
            }

            try
            {
                // Kiểm tra định dạng file
                string[] allowedExtensions = { ".jpg", ".jpeg", ".png", ".gif" };
                string extension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();

                if (!allowedExtensions.Contains(extension))
                {
                    _logger.LogWarning("Định dạng file không hợp lệ: {Extension} cho ứng cử viên ID: {Id}", extension, id);
                    return BadRequest(new { success = false, message = "Định dạng file không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG và GIF." });
                }

                // Tạo tên file duy nhất
                string uniqueFileName = $"candidate_{id}_{Guid.NewGuid()}{extension}";

                // Kiểm tra xem tên file đã tồn tại trên Azure chưa
                bool fileExists = await _azureBlobService.BlobExistsAsync(uniqueFileName);
                if (fileExists)
                {
                    // Nếu đã tồn tại, tạo tên file mới
                    uniqueFileName = $"candidate_{id}_{Guid.NewGuid()}{extension}";
                    _logger.LogInformation("Tạo tên file mới do trùng lặp: {FileName}", uniqueFileName);
                }

                string fileUrl;
                string sasUrl;

                // Upload file lên Azure Blob Storage
                using (var stream = imageFile.OpenReadStream())
                {
                    // Upload file
                    _logger.LogInformation("Đang upload file {FileName} lên Azure", uniqueFileName);
                    fileUrl = await _azureBlobService.UploadFileAsync(stream, uniqueFileName, imageFile.ContentType);
                    _logger.LogInformation("Upload file thành công: {FileUrl}", fileUrl);

                    // Tạo URL có SAS token
                    sasUrl = _azureBlobService.GenerateSasToken(uniqueFileName, 60); // Token hết hạn sau 60 phút
                    _logger.LogInformation("Đã tạo SAS token cho file");
                }

                // Kiểm tra lại xem blob đã tồn tại chưa
                bool blobExists = await _azureBlobService.BlobExistsAsync(uniqueFileName);
                if (!blobExists)
                {
                    _logger.LogError("Không tìm thấy blob sau khi upload: {FileName}", uniqueFileName);
                    return StatusCode(500, new { success = false, message = "Lỗi khi upload file lên Azure. File không tồn tại sau khi upload." });
                }

                // Lấy thời gian hiện tại ở múi giờ UTC
                var uploadTimeUtc = DateTimeOffset.UtcNow;
                var uploadTimeUtc7 = uploadTimeUtc.ToOffset(TimeSpan.FromHours(7));

                // Xóa ảnh cũ nếu có
                if (!string.IsNullOrEmpty(ungCuVien.Anh))
                {
                    try
                    {
                        // Tìm bản ghi trong bảng UploadFile
                        var oldUploadFile = await _context.UploadFiles
                            .FirstOrDefaultAsync(f => f.TenFileDuocTao == ungCuVien.Anh);

                        // Xóa bản ghi trong UploadFile nếu có
                        if (oldUploadFile != null)
                        {
                            _context.UploadFiles.Remove(oldUploadFile);
                            _logger.LogInformation("Đã xóa thông tin file cũ khỏi DB: {FileName}", ungCuVien.Anh);
                        }

                        // Xóa blob cũ trên Azure
                        bool oldBlobExists = await _azureBlobService.BlobExistsAsync(ungCuVien.Anh);
                        if (oldBlobExists)
                        {
                            await _azureBlobService.DeleteBlobAsync(ungCuVien.Anh);
                            _logger.LogInformation("Đã xóa file cũ khỏi Azure: {FileName}", ungCuVien.Anh);
                        }
                    }
                    catch (Exception ex)
                    {
                        // Ghi log nhưng không làm gián đoạn quy trình
                        _logger.LogWarning(ex, "Lỗi khi xóa ảnh cũ: {FileName} cho ứng cử viên ID: {Id}", ungCuVien.Anh, id);
                    }
                }

                // 1. Cập nhật thông tin trong bảng UngCuVien
                ungCuVien.Anh = uniqueFileName;

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
                    PhienBauCuUploadId = (int)ungCuVien.PhienBauCuId,
                    CuocBauCuUploadId = ungCuVien.CuocBauCuId,
                    KichThuocHienThi = FormatFileSize(imageFile.Length),
                    NgayHienThi = uploadTimeUtc7.ToString("dd/MM/yyyy HH:mm")
                };

                _context.UploadFiles.Add(uploadFile);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Upload ảnh thành công cho ứng cử viên ID: {Id}, Tên file: {FileName}", id, uniqueFileName);

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
                        ngayUpload = uploadFile.NgayHienThi,
                        noiDungType = uploadFile.NoiDungType
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tải ảnh cho ứng cử viên ID: {Id}", id);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi tải lên ảnh: {ex.Message}" });
            }
        }

        // API: Lấy ảnh của ứng cử viên
        [HttpGet("getImage/{id}")]
        public async Task<IActionResult> GetImage(int id)
        {
            try
            {
                var ungCuVien = await _context.UngCuViens.FindAsync(id);
                if (ungCuVien == null)
                {
                    _logger.LogWarning("Không tìm thấy ứng cử viên ID: {Id}", id);
                    return NotFound(new { success = false, message = "Không tìm thấy ứng cử viên." });
                }

                // Kiểm tra xem có ảnh không
                if (string.IsNullOrEmpty(ungCuVien.Anh))
                {
                    _logger.LogWarning("Ứng cử viên ID: {Id} chưa có ảnh", id);
                    return NotFound(new { success = false, message = "Ứng cử viên này chưa có ảnh." });
                }

                // Tìm thông tin chi tiết trong bảng UploadFile
                var uploadFile = await _context.UploadFiles
                    .FirstOrDefaultAsync(f => f.TenFileDuocTao == ungCuVien.Anh && f.CuocBauCuUploadId == ungCuVien.CuocBauCuId);

                // Kiểm tra xem blob có tồn tại không
                bool blobExists = await _azureBlobService.BlobExistsAsync(ungCuVien.Anh);
                if (!blobExists)
                {
                    _logger.LogWarning("Không tìm thấy file ảnh trên Azure: {FileName} cho ứng cử viên ID: {Id}", ungCuVien.Anh, id);
                    return NotFound(new { success = false, message = "Không tìm thấy file ảnh trên Azure." });
                }

                // Tạo URL với SAS token
                string sasUrl = _azureBlobService.GenerateSasToken(ungCuVien.Anh, 60);
                _logger.LogInformation("Tạo SAS URL thành công cho ảnh: {FileName} của ứng cử viên ID: {Id}", ungCuVien.Anh, id);

                var result = new
                {
                    success = true,
                    imageUrl = sasUrl,
                    fileName = ungCuVien.Anh
                };

                // Nếu có thông tin file trong UploadFile, bổ sung thêm
                if (uploadFile != null)
                {
                    return Ok(new
                    {
                        success = true,
                        imageUrl = sasUrl,
                        fileName = ungCuVien.Anh,
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
                _logger.LogError(ex, "Lỗi khi lấy ảnh cho ứng cử viên ID: {Id}", id);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi lấy ảnh: {ex.Message}" });
            }
        }

        // API: Xóa ảnh của ứng cử viên
        [HttpDelete("deleteImage/{id}")]
        public async Task<IActionResult> DeleteImage(int id, [FromQuery] string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return BadRequest(new { success = false, message = "Tên file không được để trống." });
            }

            try
            {
                var ungCuVien = await _context.UngCuViens
                    .Include(u => u.CuocBauCu) // Đảm bảo include để kiểm tra quyền
                    .FirstOrDefaultAsync(u => u.Id == id);

                if (ungCuVien == null)
                {
                    _logger.LogWarning("Không tìm thấy ứng cử viên ID: {Id}", id);
                    return NotFound(new { success = false, message = "Không tìm thấy ứng cử viên." });
                }

                // Kiểm tra quyền người dùng
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    _logger.LogWarning("Người dùng không xác định khi xóa ảnh cho ứng cử viên ID: {Id}", id);
                    return StatusCode(403, new { success = false, message = "Bạn không có quyền xóa ảnh cho ứng cử viên này." });
                }

                // Kiểm tra quyền quản lý cuộc bầu cử
                if (ungCuVien.CuocBauCu == null || ungCuVien.CuocBauCu.TaiKhoanId != userId)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền xóa ảnh cho ứng cử viên ID: {Id}", userId, id);
                    return StatusCode(403, new { success = false, message = "Bạn không có quyền xóa ảnh cho ứng cử viên này." });
                }

                // Kiểm tra xem ảnh có thuộc về ứng cử viên này không
                if (ungCuVien.Anh != fileName)
                {
                    _logger.LogWarning("Ảnh {FileName} không thuộc về ứng cử viên ID: {Id}", fileName, id);
                    return BadRequest(new { success = false, message = "Ảnh không thuộc về ứng cử viên này." });
                }

                // Kiểm tra sự tồn tại của blob trên Azure
                bool exists = await _azureBlobService.BlobExistsAsync(fileName);
                if (!exists)
                {
                    // Nếu không tồn tại trên Azure, cập nhật CSDL và trả về thành công
                    ungCuVien.Anh = null;
                    await _context.SaveChangesAsync();

                    _logger.LogWarning("File không tồn tại trên Azure nhưng đã cập nhật DB: {FileName}", fileName);
                    return Ok(new { success = true, message = "Đã xóa tham chiếu đến ảnh khỏi ứng cử viên." });
                }

                // Tìm bản ghi trong bảng UploadFile
                var uploadFile = await _context.UploadFiles
                    .FirstOrDefaultAsync(f => f.TenFileDuocTao == fileName && f.CuocBauCuUploadId == ungCuVien.CuocBauCuId);

                // 1. Xóa tham chiếu trong bảng UngCuVien
                ungCuVien.Anh = null;

                // 2. Xóa bản ghi trong bảng UploadFile nếu có
                if (uploadFile != null)
                {
                    _context.UploadFiles.Remove(uploadFile);
                    _logger.LogInformation("Đã xóa thông tin file khỏi DB: {FileName}", fileName);
                }

                await _context.SaveChangesAsync();

                // 3. Xóa blob trên Azure
                await _azureBlobService.DeleteBlobAsync(fileName);
                _logger.LogInformation("Đã xóa file khỏi Azure: {FileName}", fileName);

                _logger.LogInformation("Xóa ảnh thành công cho ứng cử viên ID: {Id}, Tên file: {FileName}", id, fileName);
                return Ok(new { success = true, message = "Xóa ảnh thành công." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xóa ảnh cho ứng cử viên ID: {Id}, Tên file: {FileName}", id, fileName);
                return StatusCode(500, new { success = false, message = $"Có lỗi khi xóa ảnh: {ex.Message}" });
            }
        }

        // API: Lấy danh sách ảnh của nhiều ứng cử viên
        [HttpGet("getImages")]
        public async Task<IActionResult> GetImages([FromQuery] int[] ids)
        {
            if (ids == null || ids.Length == 0)
            {
                return BadRequest(new { success = false, message = "Cần cung cấp ít nhất một ID ứng cử viên." });
            }

            try
            {
                var ungCuViens = await _context.UngCuViens
                    .Where(u => ids.Contains(u.Id) && !string.IsNullOrEmpty(u.Anh))
                    .ToListAsync();

                if (!ungCuViens.Any())
                {
                    return Ok(new { success = true, message = "Không tìm thấy ứng cử viên nào có ảnh.", images = new List<object>() });
                }

                // Lấy danh sách các tên file ảnh
                var fileNames = ungCuViens.Select(u => u.Anh).ToList();

                // Lấy thông tin file từ UploadFile
                var uploadFiles = await _context.UploadFiles
                    .Where(f => fileNames.Contains(f.TenFileDuocTao))
                    .ToListAsync();

                var result = new List<object>();

                foreach (var ungCuVien in ungCuViens)
                {
                    bool blobExists = await _azureBlobService.BlobExistsAsync(ungCuVien.Anh);
                    if (blobExists)
                    {
                        string sasUrl = _azureBlobService.GenerateSasToken(ungCuVien.Anh, 60);

                        var uploadFile = uploadFiles.FirstOrDefault(f => f.TenFileDuocTao == ungCuVien.Anh && f.CuocBauCuUploadId == ungCuVien.CuocBauCuId);

                        var imageInfo = new
                        {
                            ungCuVienId = ungCuVien.Id,
                            imageUrl = sasUrl,
                            fileName = ungCuVien.Anh
                        };

                        // Nếu có thông tin trong UploadFile, bổ sung thêm
                        if (uploadFile != null)
                        {
                            var detailedImageInfo = new
                            {
                                ungCuVienId = ungCuVien.Id,
                                imageUrl = sasUrl,
                                fileName = ungCuVien.Anh,
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
                _logger.LogError(ex, "Lỗi khi lấy danh sách ảnh cho các ứng cử viên IDs: {Ids}", string.Join(", ", ids));
                return StatusCode(500, new { success = false, message = $"Có lỗi khi lấy danh sách ảnh: {ex.Message}" });
            }
        }

        // API: Lấy danh sách ứng cử viên đã có ảnh bởi PhienBauCuId
        [HttpGet("withImages/phienbaucu/{phienBauCuId}")]
        public async Task<ActionResult<IEnumerable<UngCuVienWithImageDTO>>> GetUngCuViensWithImagesByPhienBauCuId(int phienBauCuId)
        {
            try
            {
                var ungCuViens = await _context.UngCuViens
                    .Where(u => u.PhienBauCuId == phienBauCuId && !string.IsNullOrEmpty(u.Anh))
                    .ToListAsync();

                if (!ungCuViens.Any())
                {
                    _logger.LogInformation("Không có ứng cử viên nào có ảnh cho phiên bầu cử ID: {Id}", phienBauCuId);
                    return Ok(new { success = true, message = "Không có ứng cử viên nào có ảnh.", candidates = new List<object>() });
                }

                // Lấy danh sách các tên file ảnh
                var fileNames = ungCuViens.Select(u => u.Anh).ToList();

                // Lấy thông tin file từ UploadFile
                var uploadFiles = await _context.UploadFiles
                    .Where(f => fileNames.Contains(f.TenFileDuocTao))
                    .ToListAsync();

                var result = new List<UngCuVienWithImageDTO>();

                foreach (var ungCuVien in ungCuViens)
                {
                    // Kiểm tra xem blob có tồn tại không
                    bool blobExists = await _azureBlobService.BlobExistsAsync(ungCuVien.Anh);
                    if (blobExists)
                    {
                        // Tạo URL có SAS token
                        string sasUrl = _azureBlobService.GenerateSasToken(ungCuVien.Anh, 60);

                        // Tạo đối tượng ứng cử viên
                        var candidate = new UngCuVienWithImageDTO
                        {
                            Id = ungCuVien.Id,
                            HoTen = ungCuVien.HoTen,
                            Anh = ungCuVien.Anh,
                            AnhUrl = sasUrl,
                            MoTa = ungCuVien.MoTa,
                            ViTriUngCuId = ungCuVien.ViTriUngCuId,
                            CuocBauCuId = ungCuVien.CuocBauCuId,
                            PhienBauCuId = ungCuVien.PhienBauCuId,
                            TaiKhoanId = ungCuVien.TaiKhoanId,
                            CuTriId = ungCuVien.CuTriId
                        };

                        // Kiểm tra thông tin UploadFile
                        var uploadFile = uploadFiles.FirstOrDefault(f => f.TenFileDuocTao == ungCuVien.Anh && f.CuocBauCuUploadId == ungCuVien.CuocBauCuId);
                        if (uploadFile != null)
                        {
                            candidate.FileInfo = new
                            {
                                id = uploadFile.Id,
                                tenFile = uploadFile.TenFileDuocTao,
                                kichThuoc = uploadFile.KichThuocHienThi,
                                ngayUpload = uploadFile.NgayHienThi,
                                noiDungType = uploadFile.NoiDungType
                            };
                        }

                        result.Add(candidate);
                    }
                }

                return Ok(new { success = true, candidates = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách ứng cử viên có ảnh theo phiên bầu cử ID: {Id}", phienBauCuId);
                return StatusCode(500, new { success = false, message = $"Có lỗi xảy ra: {ex.Message}" });
            }
        }

        // API: Lấy danh sách ứng cử viên đã có ảnh bởi CuocBauCuId
        [HttpGet("withImages/cuocbaucu/{cuocBauCuId}")]
        public async Task<ActionResult<IEnumerable<UngCuVienWithImageDTO>>> GetUngCuViensWithImagesByCuocBauCuId(int cuocBauCuId)
        {
            try
            {
                var ungCuViens = await _context.UngCuViens
                    .Where(u => u.CuocBauCuId == cuocBauCuId && !string.IsNullOrEmpty(u.Anh))
                    .ToListAsync();

                if (!ungCuViens.Any())
                {
                    _logger.LogInformation("Không có ứng cử viên nào có ảnh cho cuộc bầu cử ID: {Id}", cuocBauCuId);
                    return Ok(new { success = true, message = "Không có ứng cử viên nào có ảnh.", candidates = new List<object>() });
                }

                // Lấy danh sách các tên file ảnh
                var fileNames = ungCuViens.Select(u => u.Anh).ToList();

                // Lấy thông tin file từ UploadFile
                var uploadFiles = await _context.UploadFiles
                    .Where(f => fileNames.Contains(f.TenFileDuocTao) && f.CuocBauCuUploadId == cuocBauCuId)
                    .ToListAsync();

                var result = new List<UngCuVienWithImageDTO>();

                foreach (var ungCuVien in ungCuViens)
                {
                    // Kiểm tra xem blob có tồn tại không
                    bool blobExists = await _azureBlobService.BlobExistsAsync(ungCuVien.Anh);
                    if (blobExists)
                    {
                        // Tạo URL có SAS token
                        string sasUrl = _azureBlobService.GenerateSasToken(ungCuVien.Anh, 60);

                        // Tạo đối tượng ứng cử viên
                        var candidate = new UngCuVienWithImageDTO
                        {
                            Id = ungCuVien.Id,
                            HoTen = ungCuVien.HoTen,
                            Anh = ungCuVien.Anh,
                            AnhUrl = sasUrl,
                            MoTa = ungCuVien.MoTa,
                            ViTriUngCuId = ungCuVien.ViTriUngCuId,
                            CuocBauCuId = ungCuVien.CuocBauCuId,
                            PhienBauCuId = ungCuVien.PhienBauCuId,
                            TaiKhoanId = ungCuVien.TaiKhoanId,
                            CuTriId = ungCuVien.CuTriId
                        };

                        // Kiểm tra thông tin UploadFile
                        var uploadFile = uploadFiles.FirstOrDefault(f => f.TenFileDuocTao == ungCuVien.Anh && f.CuocBauCuUploadId == cuocBauCuId);
                        if (uploadFile != null)
                        {
                            candidate.FileInfo = new
                            {
                                id = uploadFile.Id,
                                tenFile = uploadFile.TenFileDuocTao,
                                kichThuoc = uploadFile.KichThuocHienThi,
                                ngayUpload = uploadFile.NgayHienThi,
                                noiDungType = uploadFile.NoiDungType
                            };
                        }

                        result.Add(candidate);
                    }
                }

                return Ok(new { success = true, candidates = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy danh sách ứng cử viên có ảnh theo cuộc bầu cử ID: {Id}", cuocBauCuId);
                return StatusCode(500, new { success = false, message = $"Có lỗi xảy ra: {ex.Message}" });
            }
        }

        #endregion

        #region Phương thức trợ giúp

        private string FormatFileSize(long bytes)
        {
            if (bytes >= 1048576)
                return $"{bytes / 1048576.0:F2} MB";
            else if (bytes >= 1024)
                return $"{bytes / 1024.0:F2} KB";
            else
                return $"{bytes} bytes";
        }

        #endregion
    }

    #region Model classes

    // Model mở rộng cho thông tin chi tiết ứng viên
    public class UngCuVienDetailDTO
    {
        public int Id { get; set; }
        public string HoTen { get; set; } = null!;
        public string? Anh { get; set; }
        public string MoTa { get; set; } = null!;
        public int ViTriUngCuId { get; set; }
        public string? TenViTriUngCu { get; set; }
        public int CuocBauCuId { get; set; }
        public string? TenCuocBauCu { get; set; }
        public int? PhienBauCuId { get; set; }
        public string? TenPhienBauCu { get; set; }
        public int? TaiKhoanId { get; set; }
        public string? TenTaiKhoan { get; set; }
        public int? CuTriId { get; set; }
        public string? EmailCuTri { get; set; }
        public string? AnhUrl { get; set; } // URL hình ảnh với SAS token
        public string? DiaChiVi { get; set; } // Địa chỉ ví blockchain
    }

    // Model cho việc đăng ký ứng viên kèm tạo cử tri
    public class UngVienRegistrationDTO
    {
        public string HoTen { get; set; }
        public string? Anh { get; set; }
        public string MoTa { get; set; } = "Ứng viên mới";
        public int ViTriUngCuId { get; set; }
        public int CuocBauCuId { get; set; }
        public int? PhienBauCuId { get; set; }
        public int? TaiKhoanId { get; set; }

        // Thông tin cử tri
        public string Sdt { get; set; }
        public string Email { get; set; }
    }

    // Model với hình ảnh
    public class UngCuVienWithImageDTO
    {
        public int Id { get; set; }
        public string HoTen { get; set; }
        public string? Anh { get; set; }
        public string? AnhUrl { get; set; }
        public string MoTa { get; set; }
        public int ViTriUngCuId { get; set; }
        public int CuocBauCuId { get; set; }
        public int? PhienBauCuId { get; set; }
        public int? TaiKhoanId { get; set; }
        public int? CuTriId { get; set; }
        public object FileInfo { get; set; }
    }

    #endregion
}