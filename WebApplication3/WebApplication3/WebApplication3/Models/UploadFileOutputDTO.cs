using System;

namespace WebApplication3.Models
{
    public class UploadFileOutputDTO
    {
        public string TenFileDuocTao { get; set; } = string.Empty;
        public string TenFileGoc { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string NoiDungType { get; set; } = string.Empty;
        public long KichThuoc { get; set; }
        public DateTimeOffset NgayUpload { get; set; }
        public string KichThuocHienThi { get; set; } = string.Empty;
        public string NgayHienThi { get; set; } = string.Empty;
    }
}
