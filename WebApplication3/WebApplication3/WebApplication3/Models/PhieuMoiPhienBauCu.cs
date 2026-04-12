using WebApplication3.Models;

public partial class PhieuMoiPhienBauCu
{
    public int Id { get; set; }
    public string Token { get; set; }
    public int PhienBauCuId { get; set; }
    public int CuocBauCuId { get; set; }
    public int NguoiTaoId { get; set; }
    public DateTime NgayTao { get; set; }
    public DateTime NgayHetHan { get; set; }
    public bool HieuLuc { get; set; }
    public virtual PhienBauCu PhienBauCu { get; set; }
    public virtual CuocBauCu CuocBauCu { get; set; }
    public virtual TaiKhoan NguoiTao { get; set; }
}
