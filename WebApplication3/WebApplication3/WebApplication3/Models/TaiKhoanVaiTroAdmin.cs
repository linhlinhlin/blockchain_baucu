using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class TaiKhoanVaiTroAdmin
{
    public int Id { get; set; }

    public int TaiKhoanId { get; set; }

    public int VaiTroId { get; set; }

    public virtual TaiKhoan TaiKhoan { get; set; } = null!;

    public virtual VaiTro VaiTro { get; set; } = null!;
}
