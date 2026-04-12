using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [Route("api/vai-tro-chuc-nang")]
    [ApiController]
    public class VaiTroChucNangController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public VaiTroChucNangController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VaiTroDTO>>> GetVaiTroChucNangs()
        {
            var vaiTroChucNangs = await _context.VaiTroChucNangs
                .Include(vtcn => vtcn.ChucNang)
                .Include(vtcn => vtcn.VaiTro)
                .ToListAsync();

            var groupedVaiTroChucNangs = vaiTroChucNangs
                .GroupBy(vtcn => vtcn.VaiTro)
                .Select(group => new VaiTroDTO
                {
                    Id = group.Key.Id,
                    TenVaiTro = group.Key.TenVaiTro,
                    ChucNangs = group.Select(vtcn => new ChucNangDTO
                    {
                        Id = vtcn.ChucNang.Id,
                        TenChucNang = vtcn.ChucNang.TenChucNang
                    }).ToList()
                })
                .ToList();

            return Ok(groupedVaiTroChucNangs);
        }

        // POST: api/vai-tro-chuc-nang/create-vai-tro
        [HttpPost("create-vai-tro")]
        public async Task<ActionResult<VaiTroDTO>> CreateVaiTro([FromBody] VaiTroDTO vaiTroDTO)
        {
            if (vaiTroDTO == null)
            {
                return BadRequest("VaiTroDTO is null");
            }

            // Check if the role name already exists
            var existingVaiTro = await _context.VaiTros
                .FirstOrDefaultAsync(vt => vt.TenVaiTro == vaiTroDTO.TenVaiTro);
            if (existingVaiTro != null)
            {
                return Conflict("A role with the same name already exists.");
            }

            var vaiTro = new VaiTro
            {
                TenVaiTro = vaiTroDTO.TenVaiTro
            };

            _context.VaiTros.Add(vaiTro);
            await _context.SaveChangesAsync();

            var chucNangs = new List<ChucNangDTO>();
            foreach (var chucNangDTO in vaiTroDTO.ChucNangs)
            {
                var vaiTroChucNang = new VaiTroChucNang
                {
                    VaiTroId = vaiTro.Id,
                    ChucNangId = chucNangDTO.Id
                };
                _context.VaiTroChucNangs.Add(vaiTroChucNang);

                var chucNang = await _context.ChucNangs.FindAsync(chucNangDTO.Id);
                if (chucNang != null)
                {
                    chucNangs.Add(new ChucNangDTO
                    {
                        Id = chucNang.Id,
                        TenChucNang = chucNang.TenChucNang
                    });
                }
            }

            await _context.SaveChangesAsync();

            var result = new VaiTroDTO
            {
                Id = vaiTro.Id,
                TenVaiTro = vaiTro.TenVaiTro,
                ChucNangs = chucNangs
            };

            return CreatedAtAction(nameof(GetVaiTroChucNangById), new { id = vaiTro.Id }, result);
        }

        // PUT: api/vai-tro-chuc-nang/update-vai-tro
        [HttpPut("update-vai-tro")]
        public async Task<IActionResult> UpdateVaiTro([FromBody] VaiTroDTO vaiTroDTO)
        {
            if (vaiTroDTO == null || vaiTroDTO.Id == 0)
            {
                return BadRequest("Invalid VaiTroDTO");
            }

            var vaiTro = await _context.VaiTros.FindAsync(vaiTroDTO.Id);
            if (vaiTro == null)
            {
                return NotFound();
            }

            vaiTro.TenVaiTro = vaiTroDTO.TenVaiTro;

            // Delete existing VaiTroChucNangs
            var existingVaiTroChucNangs = await _context.VaiTroChucNangs.Where(vtcn => vtcn.VaiTroId == vaiTroDTO.Id).ToListAsync();
            _context.VaiTroChucNangs.RemoveRange(existingVaiTroChucNangs);

            // Add new VaiTroChucNangs
            foreach (var chucNangDTO in vaiTroDTO.ChucNangs)
            {
                var vaiTroChucNang = new VaiTroChucNang
                {
                    VaiTroId = vaiTro.Id,
                    ChucNangId = chucNangDTO.Id
                };
                _context.VaiTroChucNangs.Add(vaiTroChucNang);
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/vai-tro-chuc-nang/delete-vai-tro/{id}]
        [HttpDelete("delete-vai-tro/{id}")]
        public async Task<IActionResult> DeleteVaiTro(int id)
        {
            var vaiTro = await _context.VaiTros.FindAsync(id);
            if (vaiTro == null)
            {
                return NotFound();
            }

            var vaiTroChucNangs = await _context.VaiTroChucNangs.Where(vtcn => vtcn.VaiTroId == id).ToListAsync();
            _context.VaiTroChucNangs.RemoveRange(vaiTroChucNangs);

            _context.VaiTros.Remove(vaiTro);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<VaiTroDTO>> GetVaiTroChucNangById(int id)
        {
            var vaiTroChucNangs = await _context.VaiTroChucNangs
                .Include(vtcn => vtcn.ChucNang)
                .Include(vtcn => vtcn.VaiTro)
                .Where(vtcn => vtcn.VaiTroId == id)
                .ToListAsync();

            if (!vaiTroChucNangs.Any())
            {
                return NotFound();
            }

            var vaiTroDTO = new VaiTroDTO
            {
                Id = vaiTroChucNangs.First().VaiTro.Id,
                TenVaiTro = vaiTroChucNangs.First().VaiTro.TenVaiTro,
                ChucNangs = vaiTroChucNangs.Select(vtcn => new ChucNangDTO
                {
                    Id = vtcn.ChucNang.Id,
                    TenChucNang = vtcn.ChucNang.TenChucNang
                }).ToList()
            };

            return Ok(vaiTroDTO);
        }
    }
}
