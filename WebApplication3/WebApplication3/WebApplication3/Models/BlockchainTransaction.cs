using System;
namespace WebApplication3.Models;

public class BlockchainTransaction
{
    public int Id { get; set; }
    public string TransactionHash { get; set; } = null!;
    public string LoaiGiaoDich { get; set; } = null!; // 'DEPLOY_SERVER', 'APPROVE_TOKEN'
    public int TrangThai { get; set; } = 0; // 0: Pending, 1: Success, 2: Failed
    public long? BlockNumber { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
    public int? DoiTuongId { get; set; } // ID của đối tượng liên quan (CuocBauCuId, TaiKhoanId, ...)
    public string? LoaiDoiTuong { get; set; } // 'CuocBauCu', 'TaiKhoan', ...
    public string? MetaData { get; set; } // JSON data
    public int SoLanThu { get; set; } = 0; // Số lần thử xử lý giao dịch này
}