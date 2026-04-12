using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication3.Models
{
    [Table("DieuLe")] // Thêm dòng này
    public class DieuLe
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CuocBauCuId { get; set; }

        [Required]
        [StringLength(200)]
        public string? TieuDe { get; set; }

        [Column(TypeName = "nvarchar(max)")]
        public string? NoiDung { get; set; }

        [StringLength(255)]
        public string? TenFile { get; set; }

        [StringLength(2000)]
        public string? FileUrl { get; set; }

        [Required]
        public int PhienBan { get; set; }

        [Required]
        public DateTime ThoiGianTao { get; set; }

        [Required]
        public DateTime ThoiGianCapNhat { get; set; }

        [Required]
        public int TaiKhoanCapNhatId { get; set; }

        [Required]
        public bool DaCongBo { get; set; }

        [Required]
        public bool YeuCauXacNhan { get; set; }

        // Navigation properties
        [ForeignKey("CuocBauCuId")]
        public virtual CuocBauCu? CuocBauCu { get; set; }

        [ForeignKey("TaiKhoanCapNhatId")]
        public virtual TaiKhoan? TaiKhoanCapNhat { get; set; }
    }
}