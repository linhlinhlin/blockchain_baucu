using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class ThongBao
{
    public int Id { get; set; }

    public int TaiKhoanId { get; set; }

    public string TieuDe { get; set; } = null!;

    public string NoiDung { get; set; } = null!;

    public DateTime NgayGui { get; set; }

    public bool TrangThai { get; set; }

    public virtual TaiKhoan TaiKhoan { get; set; } = null!;
}
