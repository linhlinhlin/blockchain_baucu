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
    public class ViTriUngCuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ViTriUngCuController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Lấy tất cả vị trí ứng cử
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ViTriUngCuDTO>>> GetViTriUngCus()
        {
            try
            {
                var result = await _context.ViTriUngCus
                    .Select(v => new ViTriUngCuDTO
                    {
                        Id = v.Id,
                        TenViTriUngCu = v.TenViTriUngCu,
                        SoPhieuToiDa = v.SoPhieuToiDa,
                        MoTa = v.MoTa,
                        PhienBauCuId = v.PhienBauCuId,
                        CuocBauCuId = v.CuocBauCuId
                    })
                    .ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Lấy vị trí ứng cử theo ID
        [HttpGet("{id}")]
        public async Task<ActionResult<ViTriUngCuDTO>> GetViTriUngCu(int id)
        {
            try
            {
                var viTriUngCu = await _context.ViTriUngCus.FindAsync(id);

                if (viTriUngCu == null)
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử ID={id}" });
                }

                var result = new ViTriUngCuDTO
                {
                    Id = viTriUngCu.Id,
                    TenViTriUngCu = viTriUngCu.TenViTriUngCu,
                    SoPhieuToiDa = viTriUngCu.SoPhieuToiDa,
                    MoTa = viTriUngCu.MoTa,
                    PhienBauCuId = viTriUngCu.PhienBauCuId,
                    CuocBauCuId = viTriUngCu.CuocBauCuId
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Lấy vị trí ứng cử theo PhienBauCuId
        [HttpGet("phienbaucu/{phienBauCuId}")]
        public async Task<ActionResult<IEnumerable<ViTriUngCuDTO>>> GetViTriUngCusByPhienBauCuId(int phienBauCuId)
        {
            try
            {
                var result = await _context.ViTriUngCus
                    .Where(v => v.PhienBauCuId == phienBauCuId)
                    .Select(v => new ViTriUngCuDTO
                    {
                        Id = v.Id,
                        TenViTriUngCu = v.TenViTriUngCu,
                        SoPhieuToiDa = v.SoPhieuToiDa,
                        MoTa = v.MoTa,
                        PhienBauCuId = v.PhienBauCuId,
                        CuocBauCuId = v.CuocBauCuId
                    })
                    .ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Lấy vị trí ứng cử theo CuocBauCuId
        [HttpGet("cuocbaucu/{cuocBauCuId}")]
        public async Task<ActionResult<IEnumerable<ViTriUngCuDTO>>> GetViTriUngCusByCuocBauCuId(int cuocBauCuId)
        {
            try
            {
                var result = await _context.ViTriUngCus
                    .Where(v => v.CuocBauCuId == cuocBauCuId)
                    .Select(v => new ViTriUngCuDTO
                    {
                        Id = v.Id,
                        TenViTriUngCu = v.TenViTriUngCu,
                        SoPhieuToiDa = v.SoPhieuToiDa,
                        MoTa = v.MoTa,
                        PhienBauCuId = v.PhienBauCuId,
                        CuocBauCuId = v.CuocBauCuId
                    })
                    .ToListAsync();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Thêm vị trí ứng cử mới
        [HttpPost]
        public async Task<ActionResult<ViTriUngCuDTO>> PostViTriUngCu(ViTriUngCuDTO viTriUngCuDTO)
        {
            try
            {
                var viTriUngCu = new ViTriUngCu
                {
                    TenViTriUngCu = viTriUngCuDTO.TenViTriUngCu,
                    SoPhieuToiDa = viTriUngCuDTO.SoPhieuToiDa,
                    MoTa = viTriUngCuDTO.MoTa,
                    PhienBauCuId = viTriUngCuDTO.PhienBauCuId,
                    CuocBauCuId = viTriUngCuDTO.CuocBauCuId
                };

                _context.ViTriUngCus.Add(viTriUngCu);
                await _context.SaveChangesAsync();

                viTriUngCuDTO.Id = viTriUngCu.Id;

                return CreatedAtAction(nameof(GetViTriUngCu), new { id = viTriUngCu.Id }, viTriUngCuDTO);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Thêm nhiều vị trí ứng cử cùng lúc
        [HttpPost("bulk")]
        public async Task<IActionResult> PostViTriUngCus([FromBody] List<ViTriUngCuDTO> viTriUngCuDTOs)
        {
            try
            {
                var viTriUngCus = viTriUngCuDTOs.Select(v => new ViTriUngCu
                {
                    TenViTriUngCu = v.TenViTriUngCu,
                    SoPhieuToiDa = v.SoPhieuToiDa,
                    MoTa = v.MoTa,
                    PhienBauCuId = v.PhienBauCuId,
                    CuocBauCuId = v.CuocBauCuId
                }).ToList();

                _context.ViTriUngCus.AddRange(viTriUngCus);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Thêm thành công các vị trí ứng cử" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Cập nhật vị trí ứng cử
        [HttpPut("{id}")]
        public async Task<IActionResult> PutViTriUngCu(int id, ViTriUngCuDTO viTriUngCuDTO)
        {
            try
            {
                if (id != viTriUngCuDTO.Id)
                {
                    return BadRequest(new { success = false, message = "ID không khớp" });
                }

                var viTriUngCu = await _context.ViTriUngCus.FindAsync(id);
                if (viTriUngCu == null)
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử ID={id}" });
                }

                viTriUngCu.TenViTriUngCu = viTriUngCuDTO.TenViTriUngCu;
                viTriUngCu.SoPhieuToiDa = viTriUngCuDTO.SoPhieuToiDa;
                viTriUngCu.MoTa = viTriUngCuDTO.MoTa;
                viTriUngCu.PhienBauCuId = viTriUngCuDTO.PhienBauCuId;
                viTriUngCu.CuocBauCuId = viTriUngCuDTO.CuocBauCuId;

                _context.Entry(viTriUngCu).State = EntityState.Modified;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, data = viTriUngCuDTO });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Cập nhật nhiều vị trí ứng cử cùng lúc
        [HttpPut("bulk")]
        public async Task<IActionResult> PutViTriUngCus([FromBody] List<ViTriUngCuDTO> viTriUngCuDTOs)
        {
            try
            {
                var viTriUngCuIds = viTriUngCuDTOs.Select(v => v.Id).ToList();
                var viTriUngCus = await _context.ViTriUngCus.Where(v => viTriUngCuIds.Contains(v.Id)).ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = "Không tìm thấy vị trí ứng cử nào" });
                }

                foreach (var viTriUngCu in viTriUngCus)
                {
                    var viTriUngCuDTO = viTriUngCuDTOs.First(v => v.Id == viTriUngCu.Id);
                    viTriUngCu.TenViTriUngCu = viTriUngCuDTO.TenViTriUngCu;
                    viTriUngCu.SoPhieuToiDa = viTriUngCuDTO.SoPhieuToiDa;
                    viTriUngCu.MoTa = viTriUngCuDTO.MoTa;
                    viTriUngCu.PhienBauCuId = viTriUngCuDTO.PhienBauCuId;
                    viTriUngCu.CuocBauCuId = viTriUngCuDTO.CuocBauCuId;
                }

                _context.ViTriUngCus.UpdateRange(viTriUngCus);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Cập nhật thành công các vị trí ứng cử" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Xóa vị trí ứng cử - THÊM MỚI, THIẾU ENDPOINT NÀY
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteViTriUngCu(int id)
        {
            try
            {
                var viTriUngCu = await _context.ViTriUngCus.FindAsync(id);
                if (viTriUngCu == null)
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử ID={id}" });
                }

                // Kiểm tra xem vị trí này đã có ứng viên chưa
                var hasUngVien = await _context.UngCuViens.AnyAsync(u => u.ViTriUngCuId == id);
                if (hasUngVien)
                {
                    // Có thể trả về thông báo cảnh báo hoặc xóa luôn
                    // Trong trường hợp này, chúng ta vẫn xóa nhưng thêm thông báo
                    _context.ViTriUngCus.Remove(viTriUngCu);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        success = true,
                        message = $"Đã xóa vị trí ID={id}. Lưu ý: Các ứng viên thuộc vị trí này cũng đã bị xóa",
                        warning = true
                    });
                }

                _context.ViTriUngCus.Remove(viTriUngCu);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Đã xóa vị trí ID={id}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Xóa vị trí ứng cử theo phiên bầu cử - THÊM MỚI
        [HttpDelete("phienbaucu/{phienBauCuId}")]
        public async Task<IActionResult> DeleteViTriUngCusByPhienBauCuId(int phienBauCuId)
        {
            try
            {
                var viTriUngCus = await _context.ViTriUngCus
                    .Where(v => v.PhienBauCuId == phienBauCuId)
                    .ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử nào cho phiên bầu cử ID={phienBauCuId}" });
                }

                _context.ViTriUngCus.RemoveRange(viTriUngCus);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Đã xóa tất cả vị trí ứng cử của phiên bầu cử ID={phienBauCuId}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Xóa vị trí ứng cử theo cuộc bầu cử - THÊM MỚI
        [HttpDelete("cuocbaucu/{cuocBauCuId}")]
        public async Task<IActionResult> DeleteViTriUngCusByCuocBauCuId(int cuocBauCuId)
        {
            try
            {
                var viTriUngCus = await _context.ViTriUngCus
                    .Where(v => v.CuocBauCuId == cuocBauCuId)
                    .ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử nào cho cuộc bầu cử ID={cuocBauCuId}" });
                }

                _context.ViTriUngCus.RemoveRange(viTriUngCus);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Đã xóa tất cả vị trí ứng cử của cuộc bầu cử ID={cuocBauCuId}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // Xóa nhiều vị trí ứng cử - THÊM MỚI
        [HttpDelete("multiple")]
        public async Task<IActionResult> DeleteMultipleViTriUngCu([FromBody] List<int> ids)
        {
            try
            {
                var viTriUngCus = await _context.ViTriUngCus
                    .Where(v => ids.Contains(v.Id))
                    .ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = "Không tìm thấy các vị trí ứng cử cần xóa" });
                }

                _context.ViTriUngCus.RemoveRange(viTriUngCus);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Đã xóa các vị trí ứng cử được chọn" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // API: Kiểm tra trùng lặp tên vị trí
        [HttpGet("check-duplicate")]
        public async Task<ActionResult> CheckDuplicateName([FromQuery] string name, [FromQuery] int phienBauCuId, [FromQuery] int? excludeId = null)
        {
            try
            {
                bool isDuplicate;

                if (excludeId.HasValue)
                {
                    // Nếu đang cập nhật (có ID để loại trừ)
                    isDuplicate = await _context.ViTriUngCus.AnyAsync(v =>
                        v.TenViTriUngCu.ToLower() == name.ToLower() &&
                        v.PhienBauCuId == phienBauCuId &&
                        v.Id != excludeId.Value);
                }
                else
                {
                    // Nếu đang thêm mới
                    isDuplicate = await _context.ViTriUngCus.AnyAsync(v =>
                        v.TenViTriUngCu.ToLower() == name.ToLower() &&
                        v.PhienBauCuId == phienBauCuId);
                }

                return Ok(new { isDuplicate, success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // THÊM MỚI: API lấy danh sách ứng cử viên theo vị trí ứng cử
        [HttpGet("{id}/ungcuviens")]
        public async Task<ActionResult> GetUngCuViensByViTriUngCuId(int id)
        {
            try
            {
                var viTriUngCu = await _context.ViTriUngCus.FindAsync(id);
                if (viTriUngCu == null)
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử ID={id}" });
                }

                var ungCuViens = await _context.UngCuViens
                    .Where(u => u.ViTriUngCuId == id)
                    .Select(u => new
                    {
                        id = u.Id,
                        hoTen = u.HoTen,
                        anh = u.Anh,
                        moTa = u.MoTa,
                        viTriUngCuId = u.ViTriUngCuId,
                        cuTriId = u.CuTriId,
                        phienBauCuId = u.PhienBauCuId,
                        cuocBauCuId = u.CuocBauCuId
                    })
                    .ToListAsync();

                return Ok(new { success = true, candidates = ungCuViens });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // THÊM MỚI: API đếm số lượng ứng cử viên theo vị trí
        [HttpGet("{id}/count")]
        public async Task<ActionResult> GetUngCuVienCountByViTriUngCuId(int id)
        {
            try
            {
                var viTriUngCu = await _context.ViTriUngCus.FindAsync(id);
                if (viTriUngCu == null)
                {
                    return NotFound(new { success = false, message = $"Không tìm thấy vị trí ứng cử ID={id}" });
                }

                var count = await _context.UngCuViens.CountAsync(u => u.ViTriUngCuId == id);
                return Ok(new { success = true, count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // THÊM MỚI: API thống kê số lượng ứng cử viên theo từng vị trí ứng cử của phiên bầu cử
        [HttpGet("phienbaucu/{phienBauCuId}/statistics")]
        public async Task<ActionResult> GetViTriUngCuStatisticsByPhienBauCuId(int phienBauCuId)
        {
            try
            {
                // Gọi chi tiết thống kê (tái sử dụng code đã có)
                var detailedStats = await GetDetailedStatsByPhienBauCuId(phienBauCuId);

                // Kiểm tra kết quả
                if (detailedStats is ObjectResult objResult && objResult.Value is object resultValue)
                {
                    // Trả về theo cùng format nhưng giữ tên API là statistics
                    return Ok(resultValue);
                }

                return StatusCode(500, new { success = false, message = "Không thể lấy thống kê" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // THÊM MỚI: API thống kê số lượng ứng cử viên theo từng vị trí ứng cử của cuộc bầu cử
        [HttpGet("cuocbaucu/{cuocBauCuId}/statistics")]
        public async Task<ActionResult> GetViTriUngCuStatisticsByCuocBauCuId(int cuocBauCuId)
        {
            try
            {
                var viTriUngCus = await _context.ViTriUngCus
                    .Where(v => v.CuocBauCuId == cuocBauCuId)
                    .ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = "Không tìm thấy vị trí ứng cử nào cho cuộc bầu cử này." });
                }

                var result = new List<object>();

                foreach (var viTriUngCu in viTriUngCus)
                {
                    var count = await _context.UngCuViens.CountAsync(u => u.ViTriUngCuId == viTriUngCu.Id);
                    var percentage = viTriUngCu.SoPhieuToiDa > 0
                        ? Math.Round((double)count / viTriUngCu.SoPhieuToiDa * 100)
                        : 0;

                    var status = percentage < 30 ? "Thấp" : percentage < 70 ? "Trung bình" : "Cao";

                    result.Add(new
                    {
                        id = viTriUngCu.Id,
                        tenViTriUngCu = viTriUngCu.TenViTriUngCu,
                        soPhieuToiDa = viTriUngCu.SoPhieuToiDa,
                        moTa = viTriUngCu.MoTa,
                        soUngCuVien = count,
                        tyLePercentage = percentage,
                        trangThai = status
                    });
                }

                // Tính tổng hợp
                var totalPositions = viTriUngCus.Count;
                var totalMaxVotes = viTriUngCus.Sum(v => v.SoPhieuToiDa);
                var totalCandidates = await _context.UngCuViens
                    .Where(u => u.CuocBauCuId == cuocBauCuId)
                    .CountAsync();
                var overallPercentage = totalMaxVotes > 0
                    ? Math.Round((double)totalCandidates / totalMaxVotes * 100)
                    : 0;

                var summary = new
                {
                    totalPositions,
                    totalMaxVotes,
                    totalCandidates,
                    overallPercentage
                };

                return Ok(new
                {
                    success = true,
                    statistics = result,
                    summary = summary
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // API: Lấy tất cả thông tin về vị trí ứng cử và ứng viên cho phiên bầu cử
        [HttpGet("phienbaucu/{phienBauCuId}/full-info")]
        public async Task<ActionResult> GetFullInfoByPhienBauCuId(int phienBauCuId)
        {
            try
            {
                // Lấy tất cả vị trí ứng cử
                var viTriUngCus = await _context.ViTriUngCus
                    .Where(v => v.PhienBauCuId == phienBauCuId)
                    .Select(v => new
                    {
                        id = v.Id,
                        tenViTriUngCu = v.TenViTriUngCu,
                        soPhieuToiDa = v.SoPhieuToiDa,
                        moTa = v.MoTa,
                        phienBauCuId = v.PhienBauCuId,
                        cuocBauCuId = v.CuocBauCuId
                    })
                    .ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = "Không tìm thấy vị trí ứng cử nào cho phiên bầu cử này." });
                }

                // Lấy tất cả ứng viên cho các vị trí này
                var viTriIds = viTriUngCus.Select(v => v.id).ToList();
                var ungCuViens = await _context.UngCuViens
                    .Where(u => viTriIds.Contains(u.ViTriUngCuId))
                    .Select(u => new
                    {
                        id = u.Id,
                        hoTen = u.HoTen,
                        anh = u.Anh,
                        moTa = u.MoTa,
                        viTriUngCuId = u.ViTriUngCuId,
                        cuTriId = u.CuTriId,
                        phienBauCuId = u.PhienBauCuId,
                        cuocBauCuId = u.CuocBauCuId
                    })
                    .ToListAsync();

                // Nhóm ứng viên theo vị trí
                var result = viTriUngCus.Select(v => new
                {
                    viTri = v,
                    ungViens = ungCuViens.Where(u => u.viTriUngCuId == v.id).ToList(),
                    soUngVien = ungCuViens.Count(u => u.viTriUngCuId == v.id)
                }).ToList();

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // API: Lấy số lượng ứng viên cho mỗi vị trí (chi tiết về tỷ lệ)
        [HttpGet("phienbaucu/{phienBauCuId}/detailed-stats")]
        public async Task<ActionResult> GetDetailedStatsByPhienBauCuId(int phienBauCuId)
        {
            try
            {
                var viTriUngCus = await _context.ViTriUngCus
                    .Where(v => v.PhienBauCuId == phienBauCuId)
                    .ToListAsync();

                if (!viTriUngCus.Any())
                {
                    return NotFound(new { success = false, message = "Không tìm thấy vị trí ứng cử nào cho phiên bầu cử này." });
                }

                var result = new List<object>();

                foreach (var viTriUngCu in viTriUngCus)
                {
                    var count = await _context.UngCuViens.CountAsync(u => u.ViTriUngCuId == viTriUngCu.Id);
                    var percentage = viTriUngCu.SoPhieuToiDa > 0
                        ? Math.Round((double)count / viTriUngCu.SoPhieuToiDa * 100)
                        : 0;

                    var status = percentage < 30 ? "Thấp" : percentage < 70 ? "Trung bình" : "Cao";

                    result.Add(new
                    {
                        id = viTriUngCu.Id,
                        tenViTriUngCu = viTriUngCu.TenViTriUngCu,
                        soPhieuToiDa = viTriUngCu.SoPhieuToiDa,
                        moTa = viTriUngCu.MoTa,
                        soUngCuVien = count,
                        tyLePercentage = percentage,
                        trangThai = status
                    });
                }

                // Tính tổng hợp
                var totalPositions = viTriUngCus.Count;
                var totalMaxVotes = viTriUngCus.Sum(v => v.SoPhieuToiDa);
                var totalCandidates = await _context.UngCuViens
                    .Where(u => u.PhienBauCuId == phienBauCuId)
                    .CountAsync();
                var overallPercentage = totalMaxVotes > 0
                    ? Math.Round((double)totalCandidates / totalMaxVotes * 100)
                    : 0;

                var summary = new
                {
                    totalPositions,
                    totalMaxVotes,
                    totalCandidates,
                    overallPercentage
                };

                return Ok(new
                {
                    success = true,
                    statistics = result,
                    summary = summary
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}