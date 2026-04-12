using System;

namespace WebApplication3.DTOs
{
    // DTO cơ bản để tạo/cập nhật điều lệ
    public class DieuLeDTO
    {
        public int? Id { get; set; }
        public int? CuocBauCuId { get; set; }
        public string? TieuDe { get; set; }
        public string? NoiDung { get; set; }
        public bool DaCongBo { get; set; }
        public bool YeuCauXacNhan { get; set; }
    }

    // DTO đầy đủ cho response
    public class DieuLeResponseDTO
    {
        public int Id { get; set; }
        public int CuocBauCuId { get; set; }
        public string? TieuDe { get; set; }
        public string? NoiDung { get; set; }
        public string? TenFile { get; set; }
        public string? FileUrl { get; set; }
        public int PhienBan { get; set; }
        public string? ThoiGianTao { get; set; }
        public string? ThoiGianCapNhat { get; set; }
        public int TaiKhoanCapNhatId { get; set; }
        public bool DaCongBo { get; set; }
        public bool YeuCauXacNhan { get; set; }
        public string? TenCuocBauCu { get; set; }
    }

    // DTO cho upload file
    public class UploadFileDieuLeDTO
    {
        public int DieuLeId { get; set; }
        public string? FileUrl { get; set; }
        public string? FileName { get; set; }
        public string? ContentType { get; set; }
        public long FileSize { get; set; }
    }

    // DTO cho update trạng thái công bố
    public class CapNhatTrangThaiDTO
    {
        public bool DaCongBo { get; set; }
    }

    // DTO cho gửi thông báo
    public class ThongBaoDieuLeDTO
    {
        public int CuocBauCuId { get; set; }
    }

    // DTO cho xác nhận đã đọc
    public class XacNhanDieuLeDTO
    {
        public int TaiKhoanId { get; set; }
    }

    // DTO cho kiểm tra xác nhận
    public class KiemTraXacNhanDTO
    {
        public bool DaXacNhan { get; set; }
        public string? ThoiGianXacNhan { get; set; }
    }

    // DTO response cho upload file
    public class UploadFileDieuLeResponseDTO
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public int DieuLeId { get; set; }
        public string? FileUrl { get; set; }
        public string? FileName { get; set; }
        public FileInfoDTO? FileInfo { get; set; }
    }

    // DTO thông tin file
    public class FileInfoDTO
    {
        public int Id { get; set; }
        public string? TenFile { get; set; }
        public string? KichThuoc { get; set; }
        public string? NgayUpload { get; set; }
        public string? NoiDungType { get; set; }
    }

    // DTO kết quả gửi thông báo
    public class ThongBaoKetQuaDTO
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
    }

    // DTO kết quả xác nhận điều lệ
    public class XacNhanKetQuaDTO
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
    }
}