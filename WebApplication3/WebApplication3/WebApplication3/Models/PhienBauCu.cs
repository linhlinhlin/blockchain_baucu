using System;
using System.Collections.Generic;

namespace WebApplication3.Models;

public partial class PhienBauCu
{
    public int Id { get; set; }

    public string TenPhienBauCu { get; set; } = null!;

    public int CuocBauCuId { get; set; }

    public string MoTa { get; set; } = null!;

    public DateTime NgayBatDau { get; set; }

    public DateTime NgayKetThuc { get; set; }

    public virtual ICollection<CuTri> CuTris { get; set; } = new List<CuTri>();

    public virtual CuocBauCu CuocBauCu { get; set; } = null!;

    public virtual ICollection<PhieuBau> PhieuBaus { get; set; } = new List<PhieuBau>();

    public virtual ICollection<TaiKhoanVaiTroUser> TaiKhoanVaiTroUsers { get; set; } = new List<TaiKhoanVaiTroUser>();

    public virtual ICollection<UngCuVien> UngCuViens { get; set; } = new List<UngCuVien>();

    public virtual ICollection<ViTriUngCu> ViTriUngCus { get; set; } = new List<ViTriUngCu>();

    public virtual ICollection<PhieuMoiPhienBauCu> PhieuMoiPhienBauCus { get; set; }
    public virtual ICollection<UploadFile> UploadFiles { get; set; }
}
