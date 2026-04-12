using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class PhieuBau
{
    public int Id { get; set; }

    public int UngCuVienId { get; set; }

    public int CuTriId { get; set; }

    public int ViTriUngCuId { get; set; }

    public int? PhienBauCuId { get; set; }

    public int CuocBauCuId { get; set; }

    public bool TrangThai { get; set; }

    public virtual CuTri CuTri { get; set; } = null!;

    public virtual CuocBauCu CuocBauCu { get; set; } = null!;

    public virtual PhienBauCu? PhienBauCu { get; set; }

    public virtual UngCuVien UngCuVien { get; set; } = null!;

    public virtual ViTriUngCu ViTriUngCu { get; set; } = null!;
}
