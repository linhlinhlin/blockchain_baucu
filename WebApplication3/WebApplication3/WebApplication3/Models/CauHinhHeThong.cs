using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class CauHinhHeThong
{
    public int Id { get; set; }

    public string TenCauHinh { get; set; } = null!;

    public string GiaTri { get; set; } = null!;
}
