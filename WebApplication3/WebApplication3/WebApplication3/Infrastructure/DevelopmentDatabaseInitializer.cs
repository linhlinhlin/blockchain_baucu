using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Infrastructure;

public static class DevelopmentDatabaseInitializer
{
    private const string AdminRoleName = "Quan Tri Vien";
    private const string UserRoleName = "Nguoi Dung";

    public static async Task InitializeAsync(ApplicationDbContext dbContext, ILogger logger)
    {
        var adminRole = await EnsureRoleAsync(dbContext, AdminRoleName);
        var userRole = await EnsureRoleAsync(dbContext, UserRoleName);

        await EnsureUserAsync(
            dbContext,
            userRole,
            tenDangNhap: "devuser",
            email: "devuser@local.holihu",
            tenHienThi: "Tai Khoan Dev",
            matKhau: "User@123");

        await EnsureUserAsync(
            dbContext,
            adminRole,
            tenDangNhap: "devadmin",
            email: "devadmin@local.holihu",
            tenHienThi: "Quan Tri Dev",
            matKhau: "Admin@123");

        logger.LogInformation("Development database initialized with local seed accounts.");
    }

    private static async Task<VaiTro> EnsureRoleAsync(ApplicationDbContext dbContext, string tenVaiTro)
    {
        var role = await dbContext.VaiTros.FirstOrDefaultAsync(v => v.TenVaiTro == tenVaiTro);
        if (role != null)
        {
            return role;
        }

        role = new VaiTro
        {
            TenVaiTro = tenVaiTro
        };

        dbContext.VaiTros.Add(role);
        await dbContext.SaveChangesAsync();
        return role;
    }

    private static async Task EnsureUserAsync(
        ApplicationDbContext dbContext,
        VaiTro role,
        string tenDangNhap,
        string email,
        string tenHienThi,
        string matKhau)
    {
        var taiKhoan = await dbContext.TaiKhoan.FirstOrDefaultAsync(t => t.TenDangNhap == tenDangNhap);
        if (taiKhoan == null)
        {
            taiKhoan = new TaiKhoan
            {
                TenDangNhap = tenDangNhap,
                MatKhau = BCrypt.Net.BCrypt.HashPassword(matKhau, 12),
                Email = email,
                TrangThai = true,
                NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow),
                TenHienThi = tenHienThi,
                IsMetaMask = false
            };

            dbContext.TaiKhoan.Add(taiKhoan);
            await dbContext.SaveChangesAsync();
        }

        var hasRole = await dbContext.TaiKhoanVaiTroAdmins
            .AnyAsync(x => x.TaiKhoanId == taiKhoan.Id && x.VaiTroId == role.Id);

        if (!hasRole)
        {
            dbContext.TaiKhoanVaiTroAdmins.Add(new TaiKhoanVaiTroAdmin
            {
                TaiKhoanId = taiKhoan.Id,
                VaiTroId = role.Id
            });
            await dbContext.SaveChangesAsync();
        }
    }
}
