using System.ComponentModel.DataAnnotations;
using WebApplication3.Models;

public class CuocBauCuDTO
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Tên cuộc bầu cử là bắt buộc.")]
    [StringLength(100, ErrorMessage = "Tên cuộc bầu cử không được vượt quá 100 ký tự.")]
    public string TenCuocBauCu { get; set; } = null!;

    [Required(ErrorMessage = "Mô tả là bắt buộc.")]
    public string MoTa { get; set; } = null!;

    [Required(ErrorMessage = "Ngày bắt đầu là bắt buộc.")]
    [RegularExpression(@"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$", ErrorMessage = "Ngày bắt đầu phải có định dạng dd/MM/yyyy HH:mm.")]
    public string NgayBatDau { get; set; } = null!;

    [Required(ErrorMessage = "Ngày kết thúc là bắt buộc.")]
    [RegularExpression(@"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$", ErrorMessage = "Ngày kết thúc phải có định dạng dd/MM/yyyy HH:mm.")]
    public string NgayKetThuc { get; set; } = null!;
    public int? TaiKhoanId { get; set; } // Thêm thuộc tính
    public string ? AnhCuocBauCu { get; set; }

    public string? BlockchainAddress { get; set; }
    public long? BlockchainServerId { get; set; }

}