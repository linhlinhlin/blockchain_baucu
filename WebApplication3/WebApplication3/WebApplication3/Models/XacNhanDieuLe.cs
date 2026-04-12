using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication3.Models
{
    [Table("XacNhanDieuLe")] // Thêm dòng này
    public class XacNhanDieuLe
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int DieuLeId { get; set; }

        [Required]
        public int TaiKhoanId { get; set; }

        [Required]
        public DateTime ThoiGianXacNhan { get; set; }

        // Navigation properties
        [ForeignKey("DieuLeId")]
        public virtual DieuLe? DieuLe { get; set; }

        [ForeignKey("TaiKhoanId")]
        public virtual TaiKhoan? TaiKhoan { get; set; }
    }
}