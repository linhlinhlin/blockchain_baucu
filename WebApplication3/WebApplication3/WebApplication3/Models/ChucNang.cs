using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class ChucNang
{
    public int Id { get; set; }

    public string TenChucNang { get; set; } = null!;

    public virtual ICollection<VaiTroChucNang> VaiTroChucNangs { get; set; } = new List<VaiTroChucNang>();
}
