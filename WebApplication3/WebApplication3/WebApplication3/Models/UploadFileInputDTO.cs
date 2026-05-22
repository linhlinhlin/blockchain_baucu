using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace WebApplication3.Models
{
    public class UploadFileInputDTO
    {
        [Required]
        public IFormFile File { get; set; } = null!;

        [Required]
        public int TaiKhoanUploadId { get; set; }

        [Required]
        public int PhienBauCuUploadId { get; set; }

        [Required]
        public int CuocBauCuUploadId { get; set; }
    }
}
