using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApplication3.Data;

namespace WebApplication3.Controllers
{
    [Route("api/chuc-nang")]
    [ApiController]
    public class ChucNangController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ChucNangController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<IEnumerable<ChucNangDTO>>> GetChucNangs()
        {
            var chucNangs = await _context.ChucNangs
                .Select(cn => new ChucNangDTO
                {
                    Id = cn.Id, 
                    TenChucNang = cn.TenChucNang
                })
                .ToListAsync();

            return Ok(chucNangs);
        }
    }
}
