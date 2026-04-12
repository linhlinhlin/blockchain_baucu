using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Controllers
{
    [Route("api/tai-khoan-vai-tro-admin")]
    [ApiController]
    public class TaiKhoanVaiTroAdminController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TaiKhoanVaiTroAdminController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/tai-khoan-vai-tro-admin
        [HttpGet("all")]
        public async Task<ActionResult<IEnumerable<TaiKhoanVaiTroAdminDTO>>> GetAllTaiKhoanVaiTroAdmins()
        {
            var result = await (from tkad in _context.TaiKhoanVaiTroAdmins
                                join tk in _context.TaiKhoan on tkad.TaiKhoanId equals tk.Id
                                join vt in _context.VaiTros on tkad.VaiTroId equals vt.Id
                                select new TaiKhoanVaiTroAdminDTO
                                {
                                    Id = tkad.Id,
                                    TaiKhoanId = tk.Id,
                                    VaiTroId = vt.Id,
                                    TenDangNhap = tk.TenDangNhap,
                                    Email = tk.Email,
                                    TrangThai = tk.TrangThai,
                                    TenVaiTro = vt.TenVaiTro
                                }).ToListAsync();

            return Ok(result);
        }

        // GET: api/tai-khoan-vai-tro-admin/{id}
        [HttpGet("lay/{id}")]
        public async Task<ActionResult<TaiKhoanVaiTroAdminDTO>> GetTaiKhoanVaiTroAdminById(int id)
        {
            var result = await (from tkad in _context.TaiKhoanVaiTroAdmins
                                join tk in _context.TaiKhoan on tkad.TaiKhoanId equals tk.Id
                                join vt in _context.VaiTros on tkad.VaiTroId equals vt.Id
                                where tkad.Id == id
                                select new TaiKhoanVaiTroAdminDTO
                                {
                                    Id = tkad.Id,
                                    TaiKhoanId = tk.Id,
                                    VaiTroId = vt.Id,
                                    TenDangNhap = tk.TenDangNhap,
                                    Email = tk.Email,
                                    TrangThai = tk.TrangThai,
                                    TenVaiTro = vt.TenVaiTro
                                }).FirstOrDefaultAsync();

            if (result == null)
            {
                return NotFound();
            }

            return Ok(result);
        }

        // PUT: api/tai-khoan-vai-tro-admin/update/{id}
        [HttpPut("update/{id}")]
        public async Task<IActionResult> UpdateTaiKhoanVaiTroAdmin(int id, TaiKhoanVaiTroAdminDTO dto)
        {
            if (id != dto.Id)
            {
                return BadRequest();
            }

            var taiKhoanVaiTroAdmin = await _context.TaiKhoanVaiTroAdmins.FindAsync(id);
            if (taiKhoanVaiTroAdmin == null)
            {
                return NotFound();
            }

            // Cập nhật TaiKhoanId và VaiTroId mới
            taiKhoanVaiTroAdmin.TaiKhoanId = dto.TaiKhoanId;
            taiKhoanVaiTroAdmin.VaiTroId = dto.VaiTroId;

            _context.Entry(taiKhoanVaiTroAdmin).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!TaiKhoanVaiTroAdminExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/tai-khoan-vai-tro-admin/create
        [HttpPost("create")]
        public async Task<ActionResult<TaiKhoanVaiTroAdmin>> CreateTaiKhoanVaiTroAdmin(TaiKhoanVaiTroAdminDTO dto)
        {
            var taiKhoanVaiTroAdmin = new TaiKhoanVaiTroAdmin
            {
                TaiKhoanId = dto.TaiKhoanId,
                VaiTroId = dto.VaiTroId
            };

            _context.TaiKhoanVaiTroAdmins.Add(taiKhoanVaiTroAdmin);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTaiKhoanVaiTroAdminById), new { id = taiKhoanVaiTroAdmin.Id }, taiKhoanVaiTroAdmin);
        }

        // DELETE: api/tai-khoan-vai-tro-admin/delete/{id}
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteTaiKhoanVaiTroAdmin(int id)
        {
            var taiKhoanVaiTroAdmin = await _context.TaiKhoanVaiTroAdmins.FindAsync(id);
            if (taiKhoanVaiTroAdmin == null)
            {
                return NotFound();
            }

            _context.TaiKhoanVaiTroAdmins.Remove(taiKhoanVaiTroAdmin);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/tai-khoan-vai-tro-admin/search
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<TaiKhoanVaiTroAdminDTO>>> Search(string? tenVaiTro = null, string? tenDangNhap = null, string? email = null)
        {
            var query = from tkad in _context.TaiKhoanVaiTroAdmins
                        join tk in _context.TaiKhoan on tkad.TaiKhoanId equals tk.Id
                        join vt in _context.VaiTros on tkad.VaiTroId equals vt.Id
                        select new TaiKhoanVaiTroAdminDTO
                        {
                            Id = tkad.Id,
                            TaiKhoanId = tk.Id,
                            VaiTroId = vt.Id,
                            TenDangNhap = tk.TenDangNhap,
                            Email = tk.Email,
                            TrangThai = tk.TrangThai,
                            TenVaiTro = vt.TenVaiTro
                        };

            if (!string.IsNullOrEmpty(tenVaiTro))
            {
                query = query.Where(x => x.TenVaiTro.Contains(tenVaiTro));
            }

            if (!string.IsNullOrEmpty(tenDangNhap))
            {
                query = query.Where(x => x.TenDangNhap.Contains(tenDangNhap));
            }

            if (!string.IsNullOrEmpty(email))
            {
                query = query.Where(x => x.Email.Contains(email));
            }

            var result = await query.ToListAsync();

            return Ok(result);
        }

        private bool TaiKhoanVaiTroAdminExists(int id)
        {
            return _context.TaiKhoanVaiTroAdmins.Any(e => e.Id == id);
        }
    }
}

