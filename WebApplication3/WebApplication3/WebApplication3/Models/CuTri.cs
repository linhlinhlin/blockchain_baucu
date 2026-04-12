using WebApplication3.Models;

public partial class CuTri
{
    public int Id { get; set; }
    public string Sdt { get; set; } = null!;
    public string Email { get; set; } = null!;
    public bool XacMinh { get; set; }
    public bool BoPhieu { get; set; }
    public int SoLanGuiOtp { get; set; }
    public int CuocBauCuId { get; set; }
    public int? PhienBauCuId { get; set; }
    public int? TaiKhoanId { get; set; } // Thêm thuộc tính TaiKhoanId

    public virtual CuocBauCu CuocBauCu { get; set; } = null!;
    public virtual TaiKhoan TaiKhoan { get; set; } = null!;
    public virtual PhienBauCu? PhienBauCu { get; set; }
    public virtual ICollection<PhieuBau> PhieuBaus { get; set; } = new List<PhieuBau>();
}
