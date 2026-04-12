using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class VPhieuBau
{
    public int Id { get; set; }

    public string? TenUngCuVien { get; set; }

    public string? SdtcuTri { get; set; }

    public string? TenViTriUngCu { get; set; }

    public string? TenPhienBauCu { get; set; }

    public string? TenCuocBauCu { get; set; }

    public bool TrangThai { get; set; }
}
