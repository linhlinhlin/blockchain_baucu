using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication3.Models
{
    [Table("UploadFile")]
    public class UploadFile
    {
        public int Id { get; set; }
        public string FileURL { get; set; } = string.Empty;
        public string TenFileDuocTao { get; set; } = string.Empty;
        public string TenFileGoc { get; set; } = string.Empty;
        public string NoiDungType { get; set; } = string.Empty;
        public long KichThuoc { get; set; }
        public DateTime NgayUpload { get; set; }
        public int TaiKhoanUploadId { get; set; }
        public int PhienBauCuUploadId { get; set; }
        public int CuocBauCuUploadId { get; set; }
        public string KichThuocHienThi { get; set; } = string.Empty;
        public string NgayHienThi { get; set; } = string.Empty;

        // Navigation properties
        public virtual TaiKhoan TaiKhoanUpload { get; set; } = null!;
        public virtual PhienBauCu PhienBauCuUpload { get; set; } = null!;
        public virtual CuocBauCu CuocBauCuUpload { get; set; } = null!;
    }
}
