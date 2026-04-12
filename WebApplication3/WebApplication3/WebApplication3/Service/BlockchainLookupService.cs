using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Services
{
    public interface IBlockchainLookupService
    {
        Task<string> GetVoterBlockchainAddress(int cuTriId);
        Task<string> GetCandidateBlockchainAddress(int ungCuVienId);
        Task<string> GetPrimaryWalletByAccountId(int taiKhoanId);
    }

    public class BlockchainLookupService : IBlockchainLookupService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<BlockchainLookupService> _logger;

        public BlockchainLookupService(
            ApplicationDbContext context,
            ILogger<BlockchainLookupService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Lấy địa chỉ blockchain của cử tri, ưu tiên ví SCW (LoaiVi = 2)
        /// </summary>
        public async Task<string> GetVoterBlockchainAddress(int cuTriId)
        {
            try
            {
                // Tìm cử tri
                var cuTri = await _context.CuTris
                    .FirstOrDefaultAsync(c => c.Id == cuTriId);

                if (cuTri == null)
                {
                    _logger.LogWarning("Không tìm thấy cử tri với ID: {CuTriId}", cuTriId);
                    return null;
                }

                // Nếu không có TaiKhoanId, không thể tìm ví
                if (!cuTri.TaiKhoanId.HasValue)
                {
                    _logger.LogWarning("Cử tri ID: {CuTriId} không có TaiKhoanId", cuTriId);
                    return null;
                }

                // Tìm ví với thứ tự ưu tiên:
                // 1. Ví SCW (LoaiVi = 2)
                // 2. Ví chính (IsPrimaryWallet = true)
                // 3. Bất kỳ ví nào

                // 1. Ưu tiên tìm ví SCW (LoaiVi = 2)
                var viScw = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v =>
                        v.TaiKhoanId == cuTri.TaiKhoanId &&
                        v.LoaiVi == 2);

                if (viScw != null)
                {
                    _logger.LogInformation("Đã tìm thấy ví SCW cho cử tri ID: {CuTriId}, TaiKhoanID: {TaiKhoanId}",
                        cuTriId, cuTri.TaiKhoanId);
                    return viScw.DiaChiVi;
                }

                // 2. Tìm ví chính nếu không có ví SCW
                var viPrimary = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v =>
                        v.TaiKhoanId == cuTri.TaiKhoanId &&
                        v.IsPrimaryWallet);

                if (viPrimary != null)
                {
                    _logger.LogInformation("Sử dụng ví chính cho cử tri ID: {CuTriId}, TaiKhoanID: {TaiKhoanId}",
                        cuTriId, cuTri.TaiKhoanId);
                    return viPrimary.DiaChiVi;
                }

                // 3. Tìm bất kỳ ví nào
                var viAny = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.TaiKhoanId == cuTri.TaiKhoanId);

                if (viAny != null)
                {
                    _logger.LogInformation("Sử dụng ví đầu tiên tìm thấy cho cử tri ID: {CuTriId}, TaiKhoanID: {TaiKhoanId}",
                        cuTriId, cuTri.TaiKhoanId);
                    return viAny.DiaChiVi;
                }

                _logger.LogWarning("Không tìm thấy ví blockchain cho cử tri ID: {CuTriId}, TaiKhoanID: {TaiKhoanId}",
                    cuTriId, cuTri.TaiKhoanId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy địa chỉ blockchain của cử tri ID: {CuTriId}", cuTriId);
                return null;
            }
        }

        /// <summary>
        /// Lấy địa chỉ blockchain của ứng viên, ưu tiên ví SCW (LoaiVi = 2)
        /// </summary>
        public async Task<string> GetCandidateBlockchainAddress(int ungCuVienId)
        {
            try
            {
                // Tìm ứng viên
                var ungCuVien = await _context.UngCuViens
                    .FirstOrDefaultAsync(u => u.Id == ungCuVienId);

                if (ungCuVien == null)
                {
                    _logger.LogWarning("Không tìm thấy ứng viên với ID: {UngCuVienId}", ungCuVienId);
                    return null;
                }

                // Thứ tự ưu tiên mới:
                // 1. Tìm ví SCW (LoaiVi = 2) qua TaiKhoanId trực tiếp
                // 2. Tìm ví SCW qua CuTriId
                // 3. Sử dụng ví chính qua TaiKhoanId
                // 4. Sử dụng ví chính qua CuTriId
                // 5. Sử dụng bất kỳ ví nào của tài khoản

                // Ưu tiên 1: Tìm ví SCW qua TaiKhoanId trực tiếp
                if (ungCuVien.TaiKhoanId.HasValue)
                {
                    var viScw = await _context.ViBlockchain
                        .FirstOrDefaultAsync(v =>
                            v.TaiKhoanId == ungCuVien.TaiKhoanId &&
                            v.LoaiVi == 2);

                    if (viScw != null)
                    {
                        _logger.LogInformation("Đã tìm thấy ví SCW cho ứng viên ID: {UngCuVienId}, TaiKhoanID: {TaiKhoanId}",
                            ungCuVienId, ungCuVien.TaiKhoanId);
                        return viScw.DiaChiVi;
                    }
                }

                // Ưu tiên 2: Tìm ví SCW qua CuTriId
                if (ungCuVien.CuTriId.HasValue)
                {
                    var cuTri = await _context.CuTris
                        .FirstOrDefaultAsync(c => c.Id == ungCuVien.CuTriId);

                    if (cuTri?.TaiKhoanId.HasValue == true)
                    {
                        var viCuTriScw = await _context.ViBlockchain
                            .FirstOrDefaultAsync(v =>
                                v.TaiKhoanId == cuTri.TaiKhoanId &&
                                v.LoaiVi == 2);

                        if (viCuTriScw != null)
                        {
                            _logger.LogInformation("Đã tìm thấy ví SCW qua CuTriId cho ứng viên ID: {UngCuVienId}",
                                ungCuVienId);
                            return viCuTriScw.DiaChiVi;
                        }
                    }
                }

                // Ưu tiên 3: Sử dụng ví chính qua TaiKhoanId
                if (ungCuVien.TaiKhoanId.HasValue)
                {
                    var viPrimary = await _context.ViBlockchain
                        .FirstOrDefaultAsync(v =>
                            v.TaiKhoanId == ungCuVien.TaiKhoanId &&
                            v.IsPrimaryWallet);

                    if (viPrimary != null)
                    {
                        _logger.LogInformation("Sử dụng ví chính qua TaiKhoanId cho ứng viên ID: {UngCuVienId}",
                            ungCuVienId);
                        return viPrimary.DiaChiVi;
                    }
                }

                // Ưu tiên 4: Sử dụng ví chính qua CuTriId
                if (ungCuVien.CuTriId.HasValue)
                {
                    var cuTri = await _context.CuTris
                        .FirstOrDefaultAsync(c => c.Id == ungCuVien.CuTriId);

                    if (cuTri?.TaiKhoanId.HasValue == true)
                    {
                        var viCuTriPrimary = await _context.ViBlockchain
                            .FirstOrDefaultAsync(v =>
                                v.TaiKhoanId == cuTri.TaiKhoanId &&
                                v.IsPrimaryWallet);

                        if (viCuTriPrimary != null)
                        {
                            _logger.LogInformation("Sử dụng ví chính qua CuTriId cho ứng viên ID: {UngCuVienId}",
                                ungCuVienId);
                            return viCuTriPrimary.DiaChiVi;
                        }
                    }
                }

                // Ưu tiên 5: Sử dụng bất kỳ ví nào của tài khoản
                if (ungCuVien.TaiKhoanId.HasValue)
                {
                    var viAny = await _context.ViBlockchain
                        .FirstOrDefaultAsync(v => v.TaiKhoanId == ungCuVien.TaiKhoanId);

                    if (viAny != null)
                    {
                        _logger.LogInformation("Sử dụng ví đầu tiên tìm thấy cho ứng viên ID: {UngCuVienId}",
                            ungCuVienId);
                        return viAny.DiaChiVi;
                    }
                }

                // Kiểm tra qua CuTriId nếu chưa tìm thấy ví
                if (ungCuVien.CuTriId.HasValue)
                {
                    var cuTri = await _context.CuTris
                        .FirstOrDefaultAsync(c => c.Id == ungCuVien.CuTriId);

                    if (cuTri?.TaiKhoanId.HasValue == true)
                    {
                        var viCuTriAny = await _context.ViBlockchain
                            .FirstOrDefaultAsync(v => v.TaiKhoanId == cuTri.TaiKhoanId);

                        if (viCuTriAny != null)
                        {
                            _logger.LogInformation("Sử dụng ví đầu tiên tìm thấy qua CuTriId cho ứng viên ID: {UngCuVienId}",
                                ungCuVienId);
                            return viCuTriAny.DiaChiVi;
                        }
                    }
                }

                _logger.LogWarning("Ứng viên ID: {UngCuVienId} không có ví blockchain liên kết", ungCuVienId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy địa chỉ blockchain của ứng viên ID: {UngCuVienId}", ungCuVienId);
                return null;
            }
        }

        /// <summary>
        /// Lấy ví của tài khoản, ưu tiên ví SCW (LoaiVi = 2)
        /// </summary>
        public async Task<string> GetPrimaryWalletByAccountId(int taiKhoanId)
        {
            try
            {
                // Thứ tự ưu tiên mới:
                // 1. Ví SCW (LoaiVi = 2)
                // 2. Ví chính (IsPrimaryWallet = true)
                // 3. Bất kỳ ví nào

                // Ưu tiên 1: Tìm ví SCW (LoaiVi = 2)
                var viScw = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v =>
                        v.TaiKhoanId == taiKhoanId &&
                        v.LoaiVi == 2);

                if (viScw != null)
                {
                    _logger.LogInformation("Đã tìm thấy ví SCW cho tài khoản ID: {TaiKhoanId}", taiKhoanId);
                    return viScw.DiaChiVi;
                }

                // Ưu tiên 2: Tìm ví chính (IsPrimaryWallet = true)
                var viPrimary = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v =>
                        v.TaiKhoanId == taiKhoanId &&
                        v.IsPrimaryWallet);

                if (viPrimary != null)
                {
                    _logger.LogInformation("Sử dụng ví chính cho tài khoản ID: {TaiKhoanId}", taiKhoanId);
                    return viPrimary.DiaChiVi;
                }

                // Ưu tiên 3: Bất kỳ ví nào
                var viAny = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.TaiKhoanId == taiKhoanId);

                if (viAny != null)
                {
                    _logger.LogInformation("Sử dụng ví đầu tiên tìm thấy cho tài khoản ID: {TaiKhoanId}", taiKhoanId);
                    return viAny.DiaChiVi;
                }

                _logger.LogWarning("Không tìm thấy ví blockchain cho tài khoản ID: {TaiKhoanId}", taiKhoanId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy địa chỉ ví cho tài khoản ID: {TaiKhoanId}", taiKhoanId);
                return null;
            }
        }
    }
}