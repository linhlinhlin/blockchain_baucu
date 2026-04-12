using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class ViTriUngCu
{
    public int Id { get; set; }

    public string TenViTriUngCu { get; set; } = null!;

    public int SoPhieuToiDa { get; set; }

    // Thêm trường mô tả
    public string? MoTa { get; set; }

    public int? PhienBauCuId { get; set; }

    public int CuocBauCuId { get; set; }

    public virtual CuocBauCu CuocBauCu { get; set; } = null!;

    public virtual PhienBauCu? PhienBauCu { get; set; }

    public virtual ICollection<PhieuBau> PhieuBaus { get; set; } = new List<PhieuBau>();

    public virtual ICollection<UngCuVien> UngCuViens { get; set; } = new List<UngCuVien>();
}