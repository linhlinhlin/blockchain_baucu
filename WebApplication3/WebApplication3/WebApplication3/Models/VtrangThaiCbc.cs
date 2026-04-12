using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class VtrangThaiCbc
{
    public int Id { get; set; }

    public string TenCuocBauCu { get; set; } = null!;

    public string MoTa { get; set; } = null!;

    public DateTime NgayBatDau { get; set; }

    public DateTime NgayKetThuc { get; set; }

    public string TrangThai { get; set; } = null!;
}
