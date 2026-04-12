using System;

namespace WebApplication3.Models
{
    public class UploadFileOutputDTO
    {
        public string TenFileDuocTao { get; set; }
        public string TenFileGoc { get; set; }
        public string FileUrl { get; set; }
        public string NoiDungType { get; set; }
        public long KichThuoc { get; set; }
        public DateTimeOffset NgayUpload { get; set; }
        public string KichThuocHienThi { get; set; }
        public string NgayHienThi { get; set; }
    }
}
