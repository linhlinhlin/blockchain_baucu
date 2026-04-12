using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class VaiTroChucNang
{
    public int Id { get; set; }

    public int VaiTroId { get; set; }

    public int ChucNangId { get; set; }

    public virtual ChucNang ChucNang { get; set; } = null!;

    public virtual VaiTro VaiTro { get; set; } = null!;

   

}
