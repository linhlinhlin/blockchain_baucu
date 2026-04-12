using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class VTrangThaiPbc
{
    public int Id { get; set; }

    public string TenPhienBauCu { get; set; } = null!;

    public int CuocBauCuId { get; set; }

    public string MoTa { get; set; } = null!;

    public DateTime NgayBatDau { get; set; }

    public DateTime NgayKetThuc { get; set; }

    public string TrangThai { get; set; } = null!;
}
