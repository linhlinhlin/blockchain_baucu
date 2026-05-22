using Microsoft.AspNetCore.Http;
using System;
using System.ComponentModel.DataAnnotations;

namespace WebApplication3.Models
{
    public class UploadFileDTO
    {
        // Chỉ nhận file từ request
        [Required]
        public IFormFile File { get; set; } = null!;

        [Required]
        public int TaiKhoanUploadId { get; set; }

        [Required]
        public int PhienBauCuUploadId { get; set; }

        [Required]
        public int CuocBauCuUploadId { get; set; }

        // Đảm bảo ASP.NET Core bỏ qua các trường này trong binding
        public string TenFileDuocTao { get; set; } = string.Empty;
        public string TenFileGoc { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string NoiDungType { get; set; } = string.Empty;
        public long KichThuoc { get; set; }
        public string KichThuocHienThi { get; set; } = string.Empty; // Updated to store display size
        public string NgayHienThi { get; set; } = string.Empty; // Updated to store display upload date
        public DateTime NgayUpload { get; set; }
    }
}
