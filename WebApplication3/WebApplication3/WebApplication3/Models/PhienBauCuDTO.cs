using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WebApplication3.Models;

public class PhienBauCuDTO
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Tên phiên bầu cử là bắt buộc.")]
    [StringLength(100, ErrorMessage = "Tên phiên bầu cử không được vượt quá 100 ký tự.")]
    public string TenPhienBauCu { get; set; } = null!;

    [Required(ErrorMessage = "Cuộc bầu cử ID là bắt buộc.")]
    public int CuocBauCuId { get; set; }

    [Required(ErrorMessage = "Mô tả là bắt buộc.")]
    public string MoTa { get; set; } = null!;

    [Required(ErrorMessage = "Ngày bắt đầu là bắt buộc.")]
    [RegularExpression(@"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$", ErrorMessage = "Ngày bắt đầu phải có định dạng dd/MM/yyyy HH:mm.")]
    public string NgayBatDau { get; set; } = null!;

    [Required(ErrorMessage = "Ngày kết thúc là bắt buộc.")]
    [RegularExpression(@"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$", ErrorMessage = "Ngày kết thúc phải có định dạng dd/MM/yyyy HH:mm.")]
    public string NgayKetThuc { get; set; } = null!;

    public ICollection<int> CuTriIds { get; set; } = new List<int>();

    public ICollection<int> PhieuBauIds { get; set; } = new List<int>();

    public ICollection<int> TaiKhoanVaiTroUserIds { get; set; } = new List<int>();

    public ICollection<int> UngCuVienIds { get; set; } = new List<int>();

    public ICollection<int> ViTriUngCuIds { get; set; } = new List<int>();
}
