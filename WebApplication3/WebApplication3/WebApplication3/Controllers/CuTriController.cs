using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CuTriController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly OtpController _otpController;
        private readonly ILogger<CuTriController> _logger;

        public CuTriController(ApplicationDbContext context, OtpController otpController, ILogger<CuTriController> logger)
        {
            _context = context;
            _otpController = otpController;
            _logger = logger;
        }

        /// <summary>
        /// Tìm thông tin tài khoản và ví blockchain dựa trên email
        /// </summary>
        private async Task<(int TaiKhoanId, bool CoViBlockchain)> TimThongTinTaiKhoan(string email)
        {
            if (string.IsNullOrEmpty(email))
            {
                return (0, false);
            }

            try
            {
                var taiKhoan = await _context.TaiKhoan
                    .FirstOrDefaultAsync(t => t.Email == email);

                if (taiKhoan == null)
                {
                    return (0, false);
                }

                // Kiểm tra ví blockchain - Sử dụng so sánh chính xác với true
                var viBlockchain = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.TaiKhoanId == taiKhoan.Id && v.TrangThai == true);

                return (taiKhoan.Id, viBlockchain != null);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Lỗi khi truy vấn thông tin tài khoản: {Message}", ex.Message);
                return (0, false);
            }
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<CuTriDTO>>> GetCuTris()
        {
            return await _context.CuTris
                .Select(c => new CuTriDTO
                {
                    Id = c.Id,
                    Sdt = c.Sdt,
                    Email = c.Email,
                    XacMinh = c.XacMinh,
                    BoPhieu = c.BoPhieu,
                    SoLanGuiOtp = c.SoLanGuiOtp,
                    CuocBauCuId = c.CuocBauCuId,
                    PhienBauCuId = c.PhienBauCuId,
                    TaiKhoanId = c.TaiKhoanId
                })
                .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CuTriDTO>> GetCuTri(int id)
        {
            var cuTri = await _context.CuTris.FindAsync(id);

            if (cuTri == null)
            {
                return NotFound();
            }

            return new CuTriDTO
            {
                Id = cuTri.Id,
                Sdt = cuTri.Sdt,
                Email = cuTri.Email,
                XacMinh = cuTri.XacMinh,
                BoPhieu = cuTri.BoPhieu,
                SoLanGuiOtp = cuTri.SoLanGuiOtp,
                CuocBauCuId = cuTri.CuocBauCuId,
                PhienBauCuId = cuTri.PhienBauCuId,
                TaiKhoanId = cuTri.TaiKhoanId
            };
        }

        [HttpGet("phienbaucu/{phienBauCuId}")]
        public async Task<ActionResult<IEnumerable<CuTriDTO>>> GetCuTrisByPhienBauCuId(int phienBauCuId)
        {
            return await _context.CuTris
                .Where(c => c.PhienBauCuId == phienBauCuId)
                .Select(c => new CuTriDTO
                {
                    Id = c.Id,
                    Sdt = c.Sdt,
                    Email = c.Email,
                    XacMinh = c.XacMinh,
                    BoPhieu = c.BoPhieu,
                    SoLanGuiOtp = c.SoLanGuiOtp,
                    CuocBauCuId = c.CuocBauCuId,
                    PhienBauCuId = c.PhienBauCuId,
                    TaiKhoanId = c.TaiKhoanId
                })
                .ToListAsync();
        }

        [HttpGet("cuocbaucu/{cuocBauCuId}")]
        public async Task<ActionResult<IEnumerable<CuTriDTO>>> GetCuTrisByCuocBauCuId(int cuocBauCuId)
        {
            return await _context.CuTris
                .Where(c => c.CuocBauCuId == cuocBauCuId)
                .Select(c => new CuTriDTO
                {
                    Id = c.Id,
                    Sdt = c.Sdt,
                    Email = c.Email,
                    XacMinh = c.XacMinh,
                    BoPhieu = c.BoPhieu,
                    SoLanGuiOtp = c.SoLanGuiOtp,
                    CuocBauCuId = c.CuocBauCuId,
                    PhienBauCuId = c.PhienBauCuId,
                    TaiKhoanId = c.TaiKhoanId
                })
                .ToListAsync();
        }

        [HttpGet("tenphienbaucu/{tenPhienBauCu}")]
        public async Task<ActionResult<IEnumerable<CuTriDTO>>> GetCuTrisByTenPhienBauCu(string tenPhienBauCu)
        {
            return await _context.CuTris
                .Where(c => c.PhienBauCu != null && c.PhienBauCu.TenPhienBauCu == tenPhienBauCu)
                .Select(c => new CuTriDTO
                {
                    Id = c.Id,
                    Sdt = c.Sdt,
                    Email = c.Email,
                    XacMinh = c.XacMinh,
                    BoPhieu = c.BoPhieu,
                    SoLanGuiOtp = c.SoLanGuiOtp,
                    CuocBauCuId = c.CuocBauCuId,
                    PhienBauCuId = c.PhienBauCuId,
                    TaiKhoanId = c.TaiKhoanId
                })
                .ToListAsync();
        }

        [HttpGet("tencuocbaucu/{tenCuocBauCu}")]
        public async Task<ActionResult<IEnumerable<CuTriDTO>>> GetCuTrisByTenCuocBauCu(string tenCuocBauCu)
        {
            return await _context.CuTris
                .Where(c => c.CuocBauCu.TenCuocBauCu == tenCuocBauCu)
                .Select(c => new CuTriDTO
                {
                    Id = c.Id,
                    Sdt = c.Sdt,
                    Email = c.Email,
                    XacMinh = c.XacMinh,
                    BoPhieu = c.BoPhieu,
                    SoLanGuiOtp = c.SoLanGuiOtp,
                    CuocBauCuId = c.CuocBauCuId,
                    PhienBauCuId = c.PhienBauCuId,
                    TaiKhoanId = c.TaiKhoanId
                })
                .ToListAsync();
        }

        [HttpGet("email/{email}")]
        public async Task<ActionResult<CuTriDTO>> GetCuTriByEmail(string email)
        {
            var cuTri = await _context.CuTris.FirstOrDefaultAsync(c => c.Email == email);

            if (cuTri == null)
            {
                return NotFound();
            }

            return new CuTriDTO
            {
                Id = cuTri.Id,
                Sdt = cuTri.Sdt,
                Email = cuTri.Email,
                XacMinh = cuTri.XacMinh,
                BoPhieu = cuTri.BoPhieu,
                SoLanGuiOtp = cuTri.SoLanGuiOtp,
                CuocBauCuId = cuTri.CuocBauCuId,
                PhienBauCuId = cuTri.PhienBauCuId,
                TaiKhoanId = cuTri.TaiKhoanId
            };
        }

        /// <summary>
        /// Kiểm tra trùng lặp email hoặc số điện thoại trong phạm vi phiên bầu cử
        /// </summary>
        [HttpGet("kiemtratrung")]
        public async Task<ActionResult<object>> KiemTraTrungLap(
            [FromQuery] string? email = null,
            [FromQuery] string? sdt = null,
            [FromQuery] int? phienBauCuId = null)
        {
            // Kiểm tra tham số đầu vào
            if (string.IsNullOrEmpty(email) && string.IsNullOrEmpty(sdt))
            {
                return BadRequest(new { success = false, message = "Vui lòng cung cấp email hoặc số điện thoại để kiểm tra" });
            }

            if (!phienBauCuId.HasValue)
            {
                return BadRequest(new { success = false, message = "Vui lòng cung cấp ID phiên bầu cử để kiểm tra" });
            }

            var query = _context.CuTris.AsQueryable();

            // Lọc theo phiên bầu cử
            query = query.Where(c => c.PhienBauCuId == phienBauCuId);

            // Kiểm tra trùng lặp tách biệt cho email và số điện thoại
            if (!string.IsNullOrEmpty(email))
            {
                bool emailTrungLap = await query.AnyAsync(c => c.Email == email);

                if (emailTrungLap)
                {
                    return Ok(new { trungLap = true, truong = "email", message = $"Email {email} đã tồn tại trong phiên bầu cử này" });
                }
            }

            if (!string.IsNullOrEmpty(sdt))
            {
                bool sdtTrungLap = await query.AnyAsync(c => c.Sdt == sdt);

                if (sdtTrungLap)
                {
                    return Ok(new { trungLap = true, truong = "sdt", message = $"Số điện thoại {sdt} đã tồn tại trong phiên bầu cử này" });
                }
            }

            return Ok(new { trungLap = false, truong = "", message = "Không có trùng lặp" });
        }

        // Cập nhật phương thức xác thực cử tri để sử dụng email xác thực
        /// <summary>
        /// Gửi email xác thực cho cử tri dựa trên ID
        /// </summary>
        [HttpPost("xacthuc/{id}")]
        public async Task<ActionResult<object>> XacThucCuTri(int id)
        {
            var cuTri = await _context.CuTris.FindAsync(id);

            if (cuTri == null)
            {
                return NotFound(new { success = false, message = "Không tìm thấy thông tin cử tri" });
            }

            // Kiểm tra nếu cử tri đã xác thực rồi
            if (cuTri.XacMinh)
            {
                return Ok(new
                {
                    success = true,
                    message = "Cử tri đã được xác thực trước đó",
                    status = "verified",
                    cuTri = new CuTriDTO
                    {
                        Id = cuTri.Id,
                        Sdt = cuTri.Sdt,
                        Email = cuTri.Email,
                        XacMinh = cuTri.XacMinh,
                        BoPhieu = cuTri.BoPhieu,
                        SoLanGuiOtp = cuTri.SoLanGuiOtp,
                        CuocBauCuId = cuTri.CuocBauCuId,
                        PhienBauCuId = cuTri.PhienBauCuId,
                        TaiKhoanId = cuTri.TaiKhoanId,
                    }
                });
            }

            // Kiểm tra email
            if (string.IsNullOrEmpty(cuTri.Email))
            {
                return BadRequest(new { success = false, message = "Cử tri không có địa chỉ email để gửi xác thực" });
            }

            if (!cuTri.PhienBauCuId.HasValue)
            {
                return BadRequest(new { success = false, message = "Cử tri chưa thuộc phiên bầu cử nào để gửi xác thực" });
            }

            try
            {
                // Gửi email xác thực
                var verificationResult = await _otpController.SendVoterVerification(new VoterVerificationRequest
                {
                    Email = cuTri.Email,
                    PhienBauCuId = cuTri.PhienBauCuId.Value,
                    CuocBauCuId = cuTri.CuocBauCuId
                });

                // Cập nhật số lần gửi OTP
                cuTri.SoLanGuiOtp++;
                _context.Entry(cuTri).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Email xác thực đã được gửi đến cử tri",
                    status = "pending",
                    emailSent = true,
                    otpCount = cuTri.SoLanGuiOtp,
                    cuTri = new CuTriDTO
                    {
                        Id = cuTri.Id,
                        Sdt = cuTri.Sdt,
                        Email = cuTri.Email,
                        XacMinh = cuTri.XacMinh,
                        BoPhieu = cuTri.BoPhieu,
                        SoLanGuiOtp = cuTri.SoLanGuiOtp,
                        CuocBauCuId = cuTri.CuocBauCuId,
                        PhienBauCuId = cuTri.PhienBauCuId,
                        TaiKhoanId = cuTri.TaiKhoanId,
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Không thể gửi email xác thực",
                    status = "error",
                    error = ex.Message
                });
            }
        }

        // Cập nhật phương thức xác thực nhiều cử tri
        /// <summary>
        /// Gửi email xác thực cho nhiều cử tri
        /// </summary>
        [HttpPost("xacthuc-hangloat")]
        public async Task<ActionResult<IEnumerable<object>>> XacThucHangLoatCuTri([FromBody] List<int> ids)
        {
            if (ids == null || !ids.Any())
            {
                return BadRequest(new { success = false, message = "Danh sách ID cử tri không hợp lệ" });
            }

            var ketQua = new List<object>();
            var cuTrisCapNhat = new List<CuTri>();

            foreach (var id in ids)
            {
                var cuTri = await _context.CuTris.FindAsync(id);
                if (cuTri == null)
                {
                    ketQua.Add(new
                    {
                        id,
                        thanhCong = false,
                        message = "Không tìm thấy cử tri",
                        status = "not_found"
                    });
                    continue;
                }

                if (cuTri.XacMinh)
                {
                    ketQua.Add(new
                    {
                        id,
                        thanhCong = true,
                        message = "Cử tri đã được xác thực trước đó",
                        status = "already_verified"
                    });
                    continue;
                }

                if (string.IsNullOrEmpty(cuTri.Email))
                {
                    ketQua.Add(new
                    {
                        id,
                        thanhCong = false,
                        message = "Cử tri không có địa chỉ email để gửi xác thực",
                        status = "no_email"
                    });
                    continue;
                }

                if (!cuTri.PhienBauCuId.HasValue)
                {
                    ketQua.Add(new
                    {
                        id,
                        thanhCong = false,
                        message = "Cử tri chưa thuộc phiên bầu cử nào để gửi xác thực",
                        status = "no_session"
                    });
                    continue;
                }

                try
                {
                    // Gửi email xác thực
                    await _otpController.SendVoterVerification(new VoterVerificationRequest
                    {
                        Email = cuTri.Email,
                        PhienBauCuId = cuTri.PhienBauCuId.Value,
                        CuocBauCuId = cuTri.CuocBauCuId
                    });

                    // Cập nhật số lần gửi OTP
                    cuTri.SoLanGuiOtp++;
                    cuTrisCapNhat.Add(cuTri);

                    ketQua.Add(new
                    {
                        id,
                        thanhCong = true,
                        message = "Email xác thực đã được gửi",
                        email = cuTri.Email,
                        otpCount = cuTri.SoLanGuiOtp,
                        status = "sent"
                    });
                }
                catch (Exception ex)
                {
                    ketQua.Add(new
                    {
                        id,
                        thanhCong = false,
                        message = $"Lỗi: {ex.Message}",
                        status = "error"
                    });
                }
            }

            // Cập nhật tất cả các cử tri đã gửi thành công
            if (cuTrisCapNhat.Any())
            {
                _context.CuTris.UpdateRange(cuTrisCapNhat);
                await _context.SaveChangesAsync();
            }

            return Ok(ketQua);
        }

        [HttpPost]
        public async Task<ActionResult<CuTriDTO>> PostCuTri(CuTriDTO cuTriDTO)
        {
            // Kiểm tra trùng lặp
            bool trungLap = await _context.CuTris.AnyAsync(c =>
                (c.Email == cuTriDTO.Email && !string.IsNullOrEmpty(cuTriDTO.Email)) ||
                (c.Sdt == cuTriDTO.Sdt && !string.IsNullOrEmpty(cuTriDTO.Sdt)));

            if (trungLap)
            {
                return BadRequest(new { message = "Email hoặc số điện thoại đã tồn tại trong hệ thống" });
            }

            var cuTri = new CuTri
            {
                Sdt = cuTriDTO.Sdt ?? string.Empty,
                Email = cuTriDTO.Email ?? string.Empty,
                XacMinh = false, // Mặc định là chưa xác thực khi thêm mới
                BoPhieu = cuTriDTO.BoPhieu ?? false,
                SoLanGuiOtp = cuTriDTO.SoLanGuiOtp,
                CuocBauCuId = cuTriDTO.CuocBauCuId,
                PhienBauCuId = cuTriDTO.PhienBauCuId,
                TaiKhoanId = cuTriDTO.TaiKhoanId
            };

            _context.CuTris.Add(cuTri);
            await _context.SaveChangesAsync();

            // Kiểm tra xem có thể tự động xác thực không
            var taiKhoan = await _context.TaiKhoan
                .FirstOrDefaultAsync(t => t.Email == cuTri.Email);

            if (taiKhoan != null)
            {
                var viBlockchain = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.TaiKhoanId == taiKhoan.Id && v.TrangThai == true);

                if (viBlockchain != null)
                {
                    // Tự động xác thực nếu có tài khoản và ví blockchain
                    cuTri.XacMinh = true;
                    cuTri.TaiKhoanId = taiKhoan.Id;
                    _context.Entry(cuTri).State = EntityState.Modified;
                    await _context.SaveChangesAsync();
                }
                else
                {
                    // Có tài khoản nhưng chưa có ví -> gửi email xác thực
                    if (!string.IsNullOrEmpty(cuTri.Email))
                    {
                        if (cuTri.PhienBauCuId.HasValue)
                        {
                            await _otpController.SendVoterVerification(new VoterVerificationRequest
                            {
                                Email = cuTri.Email,
                                PhienBauCuId = cuTri.PhienBauCuId.Value,
                                CuocBauCuId = cuTri.CuocBauCuId
                            });
                        }
                    }
                }
            }
            else
            {
                // Chưa có tài khoản -> gửi email xác thực
                if (!string.IsNullOrEmpty(cuTri.Email))
                {
                    if (cuTri.PhienBauCuId.HasValue)
                    {
                        await _otpController.SendVoterVerification(new VoterVerificationRequest
                        {
                            Email = cuTri.Email,
                            PhienBauCuId = cuTri.PhienBauCuId.Value,
                            CuocBauCuId = cuTri.CuocBauCuId
                        });
                    }
                }
            }

            return CreatedAtAction(nameof(GetCuTri), new { id = cuTri.Id }, new CuTriDTO
            {
                Id = cuTri.Id,
                Sdt = cuTri.Sdt,
                Email = cuTri.Email,
                XacMinh = cuTri.XacMinh,
                BoPhieu = cuTri.BoPhieu,
                SoLanGuiOtp = cuTri.SoLanGuiOtp,
                CuocBauCuId = cuTri.CuocBauCuId,
                PhienBauCuId = cuTri.PhienBauCuId,
                TaiKhoanId = cuTri.TaiKhoanId
            });
        }

        /// <summary>
        /// Thêm nhiều cử tri cùng lúc vào hệ thống
        /// </summary>
        [HttpPost("bulk")]
        public async Task<IActionResult> PostCuTris([FromBody] List<CuTriDTO> cuTriDTOs)
        {
            if (cuTriDTOs == null || !cuTriDTOs.Any())
            {
                return BadRequest(new { success = false, message = "Danh sách cử tri không hợp lệ hoặc trống" });
            }

            // Chuẩn bị danh sách kết quả chi tiết
            var resultDetails = new List<object>();
            var cuTrisSaved = new List<CuTri>();

            // Lấy tất cả phiên bầu cử trong danh sách cử tri
            var phienBauCuIds = cuTriDTOs
                .Where(c => c.PhienBauCuId.HasValue)
                .Select(c => c.PhienBauCuId.GetValueOrDefault())
                .Distinct()
                .ToList();

            if (!phienBauCuIds.Any())
            {
                return BadRequest(new { success = false, message = "Không có phiên bầu cử hợp lệ trong danh sách cử tri" });
            }

            // Kiểm tra trùng lặp trong phạm vi từng phiên bầu cử
            foreach (var phienBauCuId in phienBauCuIds)
            {
                // Lấy danh sách cử tri hiện có của phiên bầu cử
                var cuTrisHienCo = await _context.CuTris
                    .Where(c => c.PhienBauCuId == phienBauCuId)
                    .ToListAsync();

                // Danh sách email và SĐT hiện có
                var emailsHienCo = cuTrisHienCo
                    .Where(c => !string.IsNullOrEmpty(c.Email))
                    .Select(c => c.Email.ToLower())
                    .ToHashSet();

                var sdtsHienCo = cuTrisHienCo
                    .Where(c => !string.IsNullOrEmpty(c.Sdt))
                    .Select(c => c.Sdt)
                    .ToHashSet();

                // Lọc cử tri thuộc phiên bầu cử này
                var cuTriDTOsCuaPhien = cuTriDTOs
                    .Where(c => c.PhienBauCuId == phienBauCuId)
                    .ToList();

                // Kiểm tra và xử lý từng cử tri
                foreach (var cuTriDTO in cuTriDTOsCuaPhien)
                {
                    bool trungLap = false;
                    string truongTrungLap = "";

                    // Kiểm tra email trùng lặp
                    if (!string.IsNullOrEmpty(cuTriDTO.Email) && emailsHienCo.Contains(cuTriDTO.Email.ToLower()))
                    {
                        trungLap = true;
                        truongTrungLap = "email";
                    }
                    // Kiểm tra SĐT trùng lặp
                    else if (!string.IsNullOrEmpty(cuTriDTO.Sdt) && sdtsHienCo.Contains(cuTriDTO.Sdt))
                    {
                        trungLap = true;
                        truongTrungLap = "sdt";
                    }

                    if (trungLap)
                    {
                        // Thêm vào danh sách kết quả là trùng lặp
                        resultDetails.Add(new
                        {
                            email = cuTriDTO.Email,
                            sdt = cuTriDTO.Sdt,
                            phienBauCuId = cuTriDTO.PhienBauCuId,
                            trangThai = "trung_lap",
                            truongTrungLap = truongTrungLap,
                            message = $"{(truongTrungLap == "email" ? "Email" : "Số điện thoại")} đã tồn tại trong phiên bầu cử"
                        });
                        continue;
                    }

                    // Không trùng lặp, tiếp tục xử lý
                    var taiKhoanId = 0;
                    bool coViBlockchain = false;

                    // Kiểm tra tài khoản và ví blockchain nếu có email
                    if (!string.IsNullOrEmpty(cuTriDTO.Email))
                    {
                        // Sử dụng phương thức tập trung mới
                        var (foundTaiKhoanId, hasBlockchain) = await TimThongTinTaiKhoan(cuTriDTO.Email);
                        taiKhoanId = foundTaiKhoanId;
                        coViBlockchain = hasBlockchain;

                        // Thêm email vào danh sách đã xử lý
                        emailsHienCo.Add(cuTriDTO.Email.ToLower());
                    }

                    // Thêm SĐT vào danh sách đã xử lý (nếu có)
                    if (!string.IsNullOrEmpty(cuTriDTO.Sdt))
                    {
                        sdtsHienCo.Add(cuTriDTO.Sdt);
                    }

                    // Tạo cử tri mới
                    var cuTri = new CuTri
                    {
                        // Đảm bảo các trường chuỗi không null
                        Sdt = cuTriDTO.Sdt ?? string.Empty,
                        Email = cuTriDTO.Email ?? string.Empty,

                        // Đảm bảo các trường boolean có giá trị mặc định
                        XacMinh = coViBlockchain && taiKhoanId > 0, // Xác thực tự động nếu có ví blockchain

                        // QUAN TRỌNG: Chuyển từ bool? sang bool với giá trị mặc định
                        BoPhieu = cuTriDTO.BoPhieu ?? false,

                        // Đảm bảo các trường số có giá trị mặc định
                        SoLanGuiOtp = 0,
                        CuocBauCuId = cuTriDTO.CuocBauCuId,
                        PhienBauCuId = cuTriDTO.PhienBauCuId,
                        // QUAN TRỌNG: Đặt TaiKhoanId thành null khi không tìm thấy tài khoản
                        TaiKhoanId = taiKhoanId > 0 ? taiKhoanId : null,
                    };

                    cuTrisSaved.Add(cuTri);

                    // Thêm vào danh sách kết quả
                    resultDetails.Add(new
                    {
                        email = cuTriDTO.Email,
                        sdt = cuTriDTO.Sdt,
                        phienBauCuId = cuTriDTO.PhienBauCuId,
                        trangThai = coViBlockchain ? "verified" : "pending",
                        taiKhoanId = coViBlockchain ? taiKhoanId : 0,
                        xacThuc = coViBlockchain
                    });
                }
            }

            // Lưu tất cả các cử tri không trùng lặp
            if (cuTrisSaved.Any())
            {
                try
                {
                    _context.CuTris.AddRange(cuTrisSaved);
                    await _context.SaveChangesAsync();

                    // Cập nhật ID thực tế sau khi lưu
                    for (int i = 0; i < resultDetails.Count; i++)
                    {
                        var detail = resultDetails[i] as dynamic;
                        if (detail?.trangThai != "trung_lap" && i < cuTrisSaved.Count)
                        {
                            // Thêm ID thực tế sau khi lưu
                            resultDetails[i] = new
                            {
                                id = cuTrisSaved[i].Id,
                                email = detail?.email,
                                sdt = detail?.sdt,
                                phienBauCuId = detail?.phienBauCuId,
                                trangThai = detail?.trangThai,
                                taiKhoanId = detail?.taiKhoanId,
                                xacThuc = detail?.xacThuc
                            };
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Log lỗi chi tiết
                    _logger?.LogError(ex, "Lỗi khi lưu cử tri: {Message}", ex.Message);
                    return StatusCode(500, new { success = false, message = "Lỗi khi lưu cử tri", error = ex.Message });
                }
            }

            // Gửi email xác thực sau khi lưu thành công
            var cuTrisCanGuiEmail = cuTrisSaved
                .Where(c => !c.XacMinh && !string.IsNullOrEmpty(c.Email) && c.PhienBauCuId.HasValue)
                .ToList();

            if (cuTrisCanGuiEmail.Any())
            {
                foreach (var cuTri in cuTrisCanGuiEmail)
                {
                    try
                    {
                        var phienBauCuId = cuTri.PhienBauCuId.GetValueOrDefault();
                        await _otpController.SendVoterVerification(new VoterVerificationRequest
                        {
                            Email = cuTri.Email,
                            PhienBauCuId = phienBauCuId,
                            CuocBauCuId = cuTri.CuocBauCuId
                        });

                        // Cập nhật SoLanGuiOtp
                        cuTri.SoLanGuiOtp = 1;
                    }
                    catch (Exception ex)
                    {
                        // Ghi log lỗi, nhưng vẫn tiếp tục với cử tri khác
                        _logger?.LogWarning(ex, "Lỗi khi gửi email xác thực: {Message}", ex.Message);
                        continue;
                    }
                }

                // Cập nhật lại sau khi gửi email
                _context.CuTris.UpdateRange(cuTrisCanGuiEmail);
                await _context.SaveChangesAsync();
            }

            // Trả về kết quả chi tiết
            return Ok(new
            {
                success = true,
                tongSo = cuTriDTOs.Count,
                daLuu = cuTrisSaved.Count,
                daXacThuc = cuTrisSaved.Count(c => c.XacMinh),
                daGuiEmail = cuTrisCanGuiEmail.Count,
                trungLap = resultDetails.Count(d => ((dynamic)d).trangThai == "trung_lap"),
                chiTiet = resultDetails
            });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCuTri(int id, CuTriDTO cuTriDTO)
        {
            if (id != cuTriDTO.Id)
            {
                return BadRequest();
            }

            var cuTri = await _context.CuTris.FindAsync(id);
            if (cuTri == null)
            {
                return NotFound();
            }

            // Kiểm tra trùng lặp nếu thay đổi email hoặc SĐT
            if ((cuTri.Email != cuTriDTO.Email && !string.IsNullOrEmpty(cuTriDTO.Email)) ||
                (cuTri.Sdt != cuTriDTO.Sdt && !string.IsNullOrEmpty(cuTriDTO.Sdt)))
            {
                bool trungLap = await _context.CuTris
                    .Where(c => c.Id != id) // Loại trừ cử tri hiện tại
                    .AnyAsync(c =>
                        (c.Email == cuTriDTO.Email && !string.IsNullOrEmpty(cuTriDTO.Email)) ||
                        (c.Sdt == cuTriDTO.Sdt && !string.IsNullOrEmpty(cuTriDTO.Sdt)));

                if (trungLap)
                {
                    return BadRequest(new { message = "Email hoặc số điện thoại đã tồn tại trong hệ thống" });
                }
            }

            cuTri.Sdt = cuTriDTO.Sdt ?? string.Empty;
            cuTri.Email = cuTriDTO.Email ?? string.Empty;
            cuTri.XacMinh = cuTriDTO.XacMinh;
            cuTri.BoPhieu = cuTriDTO.BoPhieu ?? false;
            cuTri.SoLanGuiOtp = cuTriDTO.SoLanGuiOtp;
            cuTri.CuocBauCuId = cuTriDTO.CuocBauCuId;
            cuTri.PhienBauCuId = cuTriDTO.PhienBauCuId;
            cuTri.TaiKhoanId = cuTriDTO.TaiKhoanId;

            _context.Entry(cuTri).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCuTri(int id)
        {
            var cuTri = await _context.CuTris.FindAsync(id);
            if (cuTri == null)
            {
                return NotFound();
            }

            _context.CuTris.Remove(cuTri);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("phienbaucu/{phienBauCuId}")]
        public async Task<IActionResult> DeleteCuTrisByPhienBauCuId(int phienBauCuId)
        {
            var cuTris = await _context.CuTris.Where(c => c.PhienBauCuId == phienBauCuId).ToListAsync();
            if (!cuTris.Any())
            {
                return NotFound();
            }

            _context.CuTris.RemoveRange(cuTris);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("cuocbaucu/{cuocBauCuId}")]
        public async Task<IActionResult> DeleteCuTrisByCuocBauCuId(int cuocBauCuId)
        {
            var cuTris = await _context.CuTris.Where(c => c.CuocBauCuId == cuocBauCuId).ToListAsync();
            if (!cuTris.Any())
            {
                return NotFound();
            }

            _context.CuTris.RemoveRange(cuTris);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("multiple")]
        public async Task<IActionResult> DeleteCuTrisByIds([FromBody] List<int> ids)
        {
            var cuTris = await _context.CuTris.Where(c => ids.Contains(c.Id)).ToListAsync();
            if (!cuTris.Any())
            {
                return NotFound();
            }

            _context.CuTris.RemoveRange(cuTris);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Kiểm tra trạng thái xác thực của cử tri dựa trên email và phiên bầu cử
        /// </summary>
        [HttpGet("check-verification")]
        public async Task<ActionResult<object>> KiemTraTrangThaiXacThuc(
         [FromQuery] string email,
         [FromQuery] int phienBauCuId)
        {
            if (string.IsNullOrEmpty(email))
            {
                return BadRequest(new { success = false, message = "Email không được để trống" });
            }

            // Tìm cử tri theo email và phiên bầu cử
            var cuTri = await _context.CuTris
                .FirstOrDefaultAsync(c => c.Email == email && c.PhienBauCuId == phienBauCuId);

            if (cuTri == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "Không tìm thấy cử tri với email này trong phiên bầu cử"
                });
            }

            // Kiểm tra tài khoản và ví blockchain
            bool hasTaiKhoan = cuTri.TaiKhoanId.HasValue && cuTri.TaiKhoanId > 0;
            bool hasBlockchainWallet = false;
            string? blockchainAddress = null; // Thêm biến này để lưu địa chỉ ví

            if (hasTaiKhoan)
            {
                // Ưu tiên ví SCW (LoaiVi = 2)
                var scwWallet = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.TaiKhoanId == cuTri.TaiKhoanId && v.TrangThai == true && v.LoaiVi == 2);

                if (scwWallet != null)
                {
                    hasBlockchainWallet = true;
                    blockchainAddress = scwWallet.DiaChiVi;
                }
                else
                {
                    // Nếu không có SCW, tìm ví loại khác
                    var otherWallet = await _context.ViBlockchain
                        .FirstOrDefaultAsync(v => v.TaiKhoanId == cuTri.TaiKhoanId && v.TrangThai == true);

                    hasBlockchainWallet = otherWallet != null;
                    blockchainAddress = otherWallet?.DiaChiVi;
                }
            }

            return Ok(new
            {
                success = true,
                id = cuTri.Id,
                email = cuTri.Email,
                sdt = cuTri.Sdt,
                xacMinh = cuTri.XacMinh,
                boPhieu = cuTri.BoPhieu,
                soLanGuiOtp = cuTri.SoLanGuiOtp,
                phienBauCuId = cuTri.PhienBauCuId,
                hasTaiKhoan = hasTaiKhoan,
                hasBlockchainWallet = hasBlockchainWallet,
                blockchainAddress = blockchainAddress, // Thêm địa chỉ ví vào response
                taiKhoanId = cuTri.TaiKhoanId,
                status = cuTri.XacMinh ? "verified" : (cuTri.SoLanGuiOtp > 0 ? "pending" : "not_sent")
            });
        }
    }
}
