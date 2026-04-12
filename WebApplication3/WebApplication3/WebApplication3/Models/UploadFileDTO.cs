using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication3.Models
{
    [Table("UploadFile")]
    public class UploadFile
    {
        public int Id { get; set; }
        public string FileURL { get; set; }
        public string TenFileDuocTao { get; set; }
        public string TenFileGoc { get; set; }
        public string NoiDungType { get; set; }
        public long KichThuoc { get; set; }
        public DateTime NgayUpload { get; set; }
        public int TaiKhoanUploadId { get; set; }
        public int PhienBauCuUploadId { get; set; }
        public int CuocBauCuUploadId { get; set; }
        public string KichThuocHienThi { get; set; }
        public string NgayHienThi { get; set; }

        // Navigation properties
        public virtual TaiKhoan TaiKhoanUpload { get; set; }
        public virtual PhienBauCu PhienBauCuUpload { get; set; }
        public virtual CuocBauCu CuocBauCuUpload { get; set; }
    }
}
