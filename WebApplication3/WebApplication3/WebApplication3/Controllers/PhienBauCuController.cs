using Microsoft.AspNetCore.Mvc;
using WebApplication3.Models;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication3.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhienBauCuController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public PhienBauCuController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/PhienBauCu
        [HttpGet]
        public ActionResult<IEnumerable<PhienBauCuDTO>> GetPhienBauCus()
        {
            var phienBauCus = _context.PhienBauCus.Select(p => new PhienBauCuDTO
            {
                Id = p.Id,
                TenPhienBauCu = p.TenPhienBauCu,
                CuocBauCuId = p.CuocBauCuId,
                MoTa = p.MoTa,
                NgayBatDau = p.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = p.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                CuTriIds = p.CuTris.Select(c => c.Id).ToList(),
                PhieuBauIds = p.PhieuBaus.Select(pb => pb.Id).ToList(),
                TaiKhoanVaiTroUserIds = p.TaiKhoanVaiTroUsers.Select(tk => tk.Id).ToList(),
                UngCuVienIds = p.UngCuViens.Select(ucv => ucv.Id).ToList(),
                ViTriUngCuIds = p.ViTriUngCus.Select(vt => vt.Id).ToList()
            }).ToList();

            return Ok(phienBauCus);
        }

        // GET: api/PhienBauCu/5
        [HttpGet("{id}")]
        public ActionResult<PhienBauCuDTO> GetPhienBauCu(int id)
        {
            var phienBauCu = _context.PhienBauCus.Select(p => new PhienBauCuDTO
            {
                Id = p.Id,
                TenPhienBauCu = p.TenPhienBauCu,
                CuocBauCuId = p.CuocBauCuId,
                MoTa = p.MoTa,
                NgayBatDau = p.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = p.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                CuTriIds = p.CuTris.Select(c => c.Id).ToList(),
                PhieuBauIds = p.PhieuBaus.Select(pb => pb.Id).ToList(),
                TaiKhoanVaiTroUserIds = p.TaiKhoanVaiTroUsers.Select(tk => tk.Id).ToList(),
                UngCuVienIds = p.UngCuViens.Select(ucv => ucv.Id).ToList(),
                ViTriUngCuIds = p.ViTriUngCus.Select(vt => vt.Id).ToList()
            }).FirstOrDefault(p => p.Id == id);

            if (phienBauCu == null)
            {
                return NotFound();
            }

            return Ok(phienBauCu);
        }

        [HttpPost]
        public ActionResult<PhienBauCuDTO> PostPhienBauCu(CreateUpdatePhienBauCuDTO phienBauCuDTO)
        {
            if (!DateTime.TryParseExact(phienBauCuDTO.NgayBatDau, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayBatDau))
            {
                return BadRequest("Invalid NgayBatDau format. Please use 'dd/MM/yyyy HH:mm'.");
            }

            if (!DateTime.TryParseExact(phienBauCuDTO.NgayKetThuc, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayKetThuc))
            {
                return BadRequest("Invalid NgayKetThuc format. Please use 'dd/MM/yyyy HH:mm'.");
            }

            // Validate CuocBauCuId
            var cuocBauCuExists = _context.CuocBauCus.Any(c => c.Id == phienBauCuDTO.CuocBauCuId);
            if (!cuocBauCuExists)
            {
                return BadRequest("Invalid CuocBauCuId. The specified CuocBauCu does not exist.");
            }

            var phienBauCu = new PhienBauCu
            {
                Id = phienBauCuDTO.Id,
                TenPhienBauCu = phienBauCuDTO.TenPhienBauCu,
                CuocBauCuId = phienBauCuDTO.CuocBauCuId,
                MoTa = phienBauCuDTO.MoTa,
                NgayBatDau = ngayBatDau,
                NgayKetThuc = ngayKetThuc
            };

            if (ngayBatDau < (DateTime)System.Data.SqlTypes.SqlDateTime.MinValue || ngayBatDau > (DateTime)System.Data.SqlTypes.SqlDateTime.MaxValue)
            {
                return BadRequest("NgayBatDau is out of the valid SQL Server date range.");
            }

            if (ngayKetThuc < (DateTime)System.Data.SqlTypes.SqlDateTime.MinValue || ngayKetThuc > (DateTime)System.Data.SqlTypes.SqlDateTime.MaxValue)
            {
                return BadRequest("NgayKetThuc is out of the valid SQL Server date range.");
            }

            _context.PhienBauCus.Add(phienBauCu);
            _context.SaveChanges();

            var resultDTO = new PhienBauCuDTO
            {
                Id = phienBauCu.Id,
                TenPhienBauCu = phienBauCu.TenPhienBauCu,
                CuocBauCuId = phienBauCu.CuocBauCuId,
                MoTa = phienBauCu.MoTa,
                NgayBatDau = phienBauCu.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                NgayKetThuc = phienBauCu.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)
            };

            return CreatedAtAction(nameof(GetPhienBauCu), new { id = resultDTO.Id }, resultDTO);
        }


        // PUT: api/PhienBauCu
        [HttpPut]
        public async Task<IActionResult> PutPhienBauCu(CreateUpdatePhienBauCuDTO phienBauCuDTO)
        {
            var phienBauCu = await _context.PhienBauCus.FindAsync(phienBauCuDTO.Id);
            if (phienBauCu == null)
            {
                return NotFound();
            }

            if (!DateTime.TryParseExact(phienBauCuDTO.NgayBatDau, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayBatDau))
            {
                return BadRequest("Invalid NgayBatDau format. Please use 'dd/MM/yyyy HH:mm'.");
            }

            if (!DateTime.TryParseExact(phienBauCuDTO.NgayKetThuc, "dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime ngayKetThuc))
            {
                return BadRequest("Invalid NgayKetThuc format. Please use 'dd/MM/yyyy HH:mm'.");
            }

            phienBauCu.TenPhienBauCu = phienBauCuDTO.TenPhienBauCu;
            phienBauCu.CuocBauCuId = phienBauCuDTO.CuocBauCuId;
            phienBauCu.MoTa = phienBauCuDTO.MoTa;
            phienBauCu.NgayBatDau = ngayBatDau;
            phienBauCu.NgayKetThuc = ngayKetThuc;

            if (ngayBatDau < (DateTime)System.Data.SqlTypes.SqlDateTime.MinValue || ngayBatDau > (DateTime)System.Data.SqlTypes.SqlDateTime.MaxValue)
            {
                return BadRequest("NgayBatDau is out of the valid SQL Server date range.");
            }

            if (ngayKetThuc < (DateTime)System.Data.SqlTypes.SqlDateTime.MinValue || ngayKetThuc > (DateTime)System.Data.SqlTypes.SqlDateTime.MaxValue)
            {
                return BadRequest("NgayKetThuc is out of the valid SQL Server date range.");
            }

            // Validate CuocBauCuId
            var cuocBauCuExists = _context.CuocBauCus.Any(c => c.Id == phienBauCuDTO.CuocBauCuId);
            if (!cuocBauCuExists)
            {
                return BadRequest("Invalid CuocBauCuId. The specified CuocBauCu does not exist.");
            }



            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/PhienBauCu/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePhienBauCu(int id)
        {
            var phienBauCu = await _context.PhienBauCus.FindAsync(id);
            if (phienBauCu == null)
            {
                return NotFound();
            }

            _context.PhienBauCus.Remove(phienBauCu);
            await _context.SaveChangesAsync();

            return NoContent();
        }
  
    [HttpGet("byCuocBauCu/{cuocBauCuId}")]
        public ActionResult<IEnumerable<PhienBauCuDTO>> GetPhienBauCusByCuocBauCuId(int cuocBauCuId)
        {
            var phienBauCus = _context.PhienBauCus
                .Where(p => p.CuocBauCuId == cuocBauCuId)
                .Select(p => new PhienBauCuDTO
                {
                    Id = p.Id,
                    TenPhienBauCu = p.TenPhienBauCu,
                    CuocBauCuId = p.CuocBauCuId,
                    MoTa = p.MoTa,
                    NgayBatDau = p.NgayBatDau.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    NgayKetThuc = p.NgayKetThuc.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture),
                    CuTriIds = p.CuTris.Select(c => c.Id).ToList(),
                    PhieuBauIds = p.PhieuBaus.Select(pb => pb.Id).ToList(),
                    TaiKhoanVaiTroUserIds = p.TaiKhoanVaiTroUsers.Select(tk => tk.Id).ToList(),
                    UngCuVienIds = p.UngCuViens.Select(ucv => ucv.Id).ToList(),
                    ViTriUngCuIds = p.ViTriUngCus.Select(vt => vt.Id).ToList()
                }).ToList();

            if (!phienBauCus.Any())
            {
                return StatusCode(404, "Khong co phien bau cu nao");
            }


            return Ok(phienBauCus);
        }
        // GET: api/PhienBauCu/tim/{tenPhienBauCu}
        [HttpGet("tim/{tenPhienBauCu}")]
        public ActionResult<IEnumerable<PhienBauCuDTO>> GetPhienBauCusByTenPhienBauCu(string tenPhienBauCu)
        {
            var phienBauCus = _context.PhienBauCus
                .Where(p => p.TenPhienBauCu.Contains(tenPhienBauCu))
                .Select(p => new PhienBauCuDTO
                {
                 
                    MoTa = p.MoTa,
                  
                }).ToList();

            if (!phienBauCus.Any())
            {
                return StatusCode(404, "Ten Phien Bau Cu Duoc Phep Dung");
            }

            return Ok(phienBauCus);
        }
    }
}
