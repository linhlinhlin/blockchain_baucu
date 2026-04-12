using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [Route("api/vai-tro")]
    [ApiController]
    public class VaiTroController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public VaiTroController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VaiTroDTO>>> GetVaiTros()
        {
            var vaiTros = await _context.VaiTros
                .Select(vt => new VaiTroDTO
                {
                    Id = vt.Id,
                    TenVaiTro = vt.TenVaiTro
                })
                .ToListAsync();

            return Ok(vaiTros);
        }

        // GET: api/vai-tro/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<VaiTroDTO>> GetVaiTro(int id)
        {
            var vaiTro = await _context.VaiTros.FindAsync(id);

            if (vaiTro == null)
            {
                return NotFound();
            }

            var vaiTroDTO = new VaiTroDTO
            {
                Id = vaiTro.Id,
                TenVaiTro = vaiTro.TenVaiTro
            };

            return Ok(vaiTroDTO);
        }

        // POST: api/vai-tro
        [HttpPost]
        public async Task<ActionResult<VaiTroDTO>> CreateVaiTro([FromBody] VaiTroDTO vaiTroDTO)
        {
            if (vaiTroDTO == null)
            {
                return BadRequest("VaiTroDTO is null");
            }

            var vaiTro = new VaiTro
            {
                TenVaiTro = vaiTroDTO.TenVaiTro
            };

            _context.VaiTros.Add(vaiTro);
            await _context.SaveChangesAsync();

            vaiTroDTO.Id = vaiTro.Id;

            return CreatedAtAction(nameof(GetVaiTro), new { id = vaiTro.Id }, vaiTroDTO);
        }

        // PUT: api/vai-tro/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateVaiTro(int id, [FromBody] VaiTroDTO vaiTroDTO)
        {
            if (vaiTroDTO == null || vaiTroDTO.Id != id)
            {
                return BadRequest("Invalid VaiTroDTO");
            }

            var vaiTro = await _context.VaiTros.FindAsync(id);
            if (vaiTro == null)
            {
                return NotFound();
            }

            vaiTro.TenVaiTro = vaiTroDTO.TenVaiTro;

            _context.Entry(vaiTro).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/vai-tro/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteVaiTro(int id)
        {
            var vaiTro = await _context.VaiTros.FindAsync(id);
            if (vaiTro == null)
            {
                return NotFound();
            }

            _context.VaiTros.Remove(vaiTro);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}

