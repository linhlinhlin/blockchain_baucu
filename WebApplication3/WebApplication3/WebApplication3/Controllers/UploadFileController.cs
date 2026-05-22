using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using WebApplication3.Services;
using WebApplication3.Models;
using Microsoft.EntityFrameworkCore;
using WebApplication3.Data;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UploadFileController : ControllerBase
    {
        private readonly IFileService _fileService;
        private readonly IAzureBlobService _azureBlobService;
        private readonly ApplicationDbContext _context;

        public UploadFileController(IFileService fileService, IAzureBlobService azureBlobService, ApplicationDbContext context)
        {
            _fileService = fileService;
            _azureBlobService = azureBlobService;
            _context = context;
        }

        [HttpPost("upload")]
        [Consumes("multipart/form-data")] // BẮT BUỘC để Swagger hiểu đây là upload file
        public async Task<IActionResult> Upload([FromForm] UploadFileInputDTO inputDto)
        {
            if (inputDto.File == null || inputDto.File.Length == 0)
                return BadRequest("File không hợp lệ");

            // Check if the file name already exists on Azure
            bool fileExists = await _azureBlobService.BlobExistsAsync(inputDto.File.FileName);
            if (fileExists)
                return BadRequest("Tên file đã tồn tại trên Azure.");

            // Verify if TaiKhoanId, PhienBauCuId, and CuocBauCuId exist by querying the database
            bool taiKhoanExists = await _context.TaiKhoan.AnyAsync(t => t.Id == inputDto.TaiKhoanUploadId);
            bool phienBauCuExists = await _context.PhienBauCus.AnyAsync(p => p.Id == inputDto.PhienBauCuUploadId);
            bool cuocBauCuExists = await _context.CuocBauCus.AnyAsync(c => c.Id == inputDto.CuocBauCuUploadId);

            if (!taiKhoanExists)
                return BadRequest("Tài khoản không tồn tại.");
            if (!phienBauCuExists)
                return BadRequest("Phiên bầu cử không tồn tại.");
            if (!cuocBauCuExists)
                return BadRequest("Cuộc bầu cử không tồn tại.");

            try
            {
                var result = await _fileService.UploadFileAsync(inputDto);
                return Ok(new { message = "Upload thành công", data = result });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Upload file thất bại", error = ex.Message });
            }
        }

        [HttpGet("all-azure-files")]
        public async Task<IActionResult> GetAllAzureFiles()
        {
            var files = await _fileService.GetAllAzureFilesAsync();
            return Ok(files);
        }

        // Endpoint lấy file theo tiêu chí
        // Mặc định nếu không có tiêu chí nào được truyền thì yêu cầu phải có phienBauCuId (giá trị mặc định) hoặc trả lỗi.
        [HttpGet("files")]
        public async Task<IActionResult> GetFilesByCriteria(
     [FromQuery] int? taiKhoanId,
     [FromQuery] int? cuocBauCuId,
     [FromQuery] int? phienBauCuId)
        {
            // Nếu không truyền tiêu chí nào, trả về lỗi
            if (!taiKhoanId.HasValue && !cuocBauCuId.HasValue && !phienBauCuId.HasValue)
            {
                return BadRequest("Phải cung cấp ít nhất một tiêu chí lọc, mặc định là theo PhienBauCuId.");
            }

            // Nếu không có tiêu chí PhienBauCu, sử dụng giá trị mặc định (ví dụ: 22)
            if (!phienBauCuId.HasValue)
            {
                phienBauCuId = 22;
            }

            // Lọc dữ liệu từ database dựa theo các tiêu chí
            var query = _context.UploadFiles.AsQueryable();

            if (taiKhoanId.HasValue)
            {
                query = query.Where(f => f.TaiKhoanUploadId == taiKhoanId.Value);
            }
            if (cuocBauCuId.HasValue)
            {
                query = query.Where(f => f.CuocBauCuUploadId == cuocBauCuId.Value);
            }
            if (phienBauCuId.HasValue)
            {
                query = query.Where(f => f.PhienBauCuUploadId == phienBauCuId.Value);
            }

            var filesFromDb = await query.ToListAsync();
            var filesWithSas = new List<object>();

            // Với mỗi file, tạo URL có SAS Token và định dạng các thông tin cần trả về
            foreach (var file in filesFromDb)
            {
                var storedFileName = file.TenFileDuocTao;
                if (string.IsNullOrWhiteSpace(storedFileName))
                {
                    continue;
                }

                // Tạo URL có SAS Token cho file (sử dụng hàm GenerateSasToken)
                string sasUrl = _azureBlobService.GenerateSasToken(storedFileName, 30);
                filesWithSas.Add(new
                {
                    FileUrl = sasUrl,
                    TenFileDuocTao = storedFileName,
                    NoiDungType = file.NoiDungType ?? string.Empty,
                    // Định dạng Ngày hiển thị dựa trên NgayUpload
                    NgayHienThi = file.NgayHienThi ?? string.Empty,
                    // Định dạng kích thước file
                    KichThuocHienThi = file.KichThuocHienThi ?? string.Empty
                });
            }

            return Ok(filesWithSas);
        }

        // Endpoint xóa file: Xóa file trên Azure và đồng thời xóa bản ghi trong SQL
        [HttpDelete("delete")]
        public async Task<IActionResult> DeleteFile([FromQuery] string fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                return BadRequest("Tên file không được để trống.");

            try
            {
                // Kiểm tra sự tồn tại của blob trên Azure
                bool exists = await _azureBlobService.BlobExistsAsync(fileName);
                if (!exists)
                {
                    return NotFound(new { message = "File không tồn tại trên Azure." });
                }

                // Tìm bản ghi trong SQL theo tên file đã được tạo
                var file = await _context.UploadFiles.FirstOrDefaultAsync(f => f.TenFileDuocTao == fileName);
                if (file == null)
                {
                    return NotFound(new { message = "File không tồn tại trong cơ sở dữ liệu." });
                }

                // Xóa bản ghi trong SQL
                _context.UploadFiles.Remove(file);
                await _context.SaveChangesAsync();

                // Xóa file trên Azure Blob Storage
                await _azureBlobService.DeleteBlobAsync(fileName);

                return Ok(new { message = "Xóa file thành công." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi khi xóa file.", error = ex.Message });
            }
        }


    }
}
