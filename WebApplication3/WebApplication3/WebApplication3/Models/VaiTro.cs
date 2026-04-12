using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class VaiTro
{
    public int Id { get; set; }

    public string TenVaiTro { get; set; } = null!;

    public virtual ICollection<TaiKhoanVaiTroAdmin> TaiKhoanVaiTroAdmins { get; set; } = new List<TaiKhoanVaiTroAdmin>();

    public virtual ICollection<TaiKhoanVaiTroUser> TaiKhoanVaiTroUsers { get; set; } = new List<TaiKhoanVaiTroUser>();

    public virtual ICollection<VaiTroChucNang> VaiTroChucNangs { get; set; } = new List<VaiTroChucNang>();
}
