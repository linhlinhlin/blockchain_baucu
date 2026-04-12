using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class LichSuHoatDong
{
    public int Id { get; set; }

    public int TaiKhoanId { get; set; }

    public string HoatDong { get; set; } = null!;

    public DateTime ThoiGian { get; set; }

    public string? MoTa { get; set; }

    public virtual TaiKhoan TaiKhoan { get; set; } = null!;
}
