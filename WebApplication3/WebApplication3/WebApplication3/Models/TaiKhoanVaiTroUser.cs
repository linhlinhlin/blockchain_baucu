using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class TaiKhoanVaiTroUser
{
    public int Id { get; set; }

    public int TaiKhoanId { get; set; }

    public int VaiTroId { get; set; }

    public int? CuocBauCuId { get; set; }

    public int? PhienBauCuId { get; set; }

    public virtual CuocBauCu? CuocBauCu { get; set; }

    public virtual PhienBauCu? PhienBauCu { get; set; }

    public virtual TaiKhoan TaiKhoan { get; set; } = null!;

    public virtual VaiTro VaiTro { get; set; } = null!;
}
