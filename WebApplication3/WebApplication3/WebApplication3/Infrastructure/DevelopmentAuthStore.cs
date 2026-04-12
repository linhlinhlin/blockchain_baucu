using BCrypt.Net;

namespace WebApplication3.Infrastructure;

public static class DevelopmentAuthStore
{
    private static readonly object SyncRoot = new();
    private static readonly List<DevelopmentAuthUser> Users =
    [
        new DevelopmentAuthUser
        {
            Id = 1,
            TenDangNhap = "devadmin",
            Email = "devadmin@local.holihu",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123", 12),
            TenHienThi = "Quan Tri Dev",
            VaiTro = "Quan Tri Vien",
            TrangThai = true,
            IsMetaMask = false
        },
        new DevelopmentAuthUser
        {
            Id = 2,
            TenDangNhap = "devuser",
            Email = "devuser@local.holihu",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("User@123", 12),
            TenHienThi = "Tai Khoan Dev",
            VaiTro = "Nguoi Dung",
            TrangThai = true,
            IsMetaMask = false
        }
    ];

    private static int _nextUserId = 3;

    public static bool UsernameExists(string tenDangNhap)
    {
        lock (SyncRoot)
        {
            return Users.Any(x =>
                x.TenDangNhap.Equals(tenDangNhap, StringComparison.OrdinalIgnoreCase));
        }
    }

    public static IReadOnlyCollection<DevelopmentAuthUser> Search(string? tenDangNhap, int? id)
    {
        lock (SyncRoot)
        {
            return Users
                .Where(x =>
                    (string.IsNullOrWhiteSpace(tenDangNhap) ||
                     x.TenDangNhap.Contains(tenDangNhap, StringComparison.OrdinalIgnoreCase)) &&
                    (!id.HasValue || x.Id == id.Value))
                .Select(Clone)
                .ToList();
        }
    }

    public static DevelopmentAuthUser? ValidateCredentials(string tenDangNhap, string matKhau)
    {
        lock (SyncRoot)
        {
            var user = Users.FirstOrDefault(x =>
                x.TenDangNhap.Equals(tenDangNhap, StringComparison.OrdinalIgnoreCase));

            if (user == null || !BCrypt.Net.BCrypt.Verify(matKhau, user.PasswordHash))
            {
                return null;
            }

            user.LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow);
            return Clone(user);
        }
    }

    public static DevelopmentAuthUser Register(
        string tenDangNhap,
        string email,
        string matKhau,
        string tenHienThi)
    {
        lock (SyncRoot)
        {
            if (Users.Any(x => x.TenDangNhap.Equals(tenDangNhap, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("Tên đăng nhập đã được sử dụng");
            }

            if (Users.Any(x => x.Email.Equals(email, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException("Email đã được sử dụng");
            }

            var user = new DevelopmentAuthUser
            {
                Id = _nextUserId++,
                TenDangNhap = tenDangNhap,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(matKhau, 12),
                TenHienThi = tenHienThi,
                VaiTro = "Nguoi Dung",
                TrangThai = true,
                IsMetaMask = false,
                NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow)
            };

            Users.Add(user);
            return Clone(user);
        }
    }

    public static DevelopmentAuthUser LoginWithMetaMask(string diaChiVi)
    {
        lock (SyncRoot)
        {
            var user = Users.FirstOrDefault(x =>
                !string.IsNullOrWhiteSpace(x.DiaChiVi) &&
                x.DiaChiVi.Equals(diaChiVi, StringComparison.OrdinalIgnoreCase));

            if (user == null)
            {
                user = new DevelopmentAuthUser
                {
                    Id = _nextUserId++,
                    TenDangNhap = $"wallet_{_nextUserId:x4}",
                    Email = $"{diaChiVi[..8].ToLowerInvariant()}@local-wallet.holihu",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                    TenHienThi = $"User_{diaChiVi[2..8]}",
                    VaiTro = "Nguoi Dung",
                    TrangThai = true,
                    IsMetaMask = true,
                    DiaChiVi = diaChiVi,
                    NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                    LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow)
                };

                Users.Add(user);
            }
            else
            {
                user.LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow);
                user.IsMetaMask = true;
                user.DiaChiVi = diaChiVi;
            }

            return Clone(user);
        }
    }

    private static DevelopmentAuthUser Clone(DevelopmentAuthUser user)
    {
        return new DevelopmentAuthUser
        {
            Id = user.Id,
            TenDangNhap = user.TenDangNhap,
            Email = user.Email,
            PasswordHash = user.PasswordHash,
            TenHienThi = user.TenHienThi,
            VaiTro = user.VaiTro,
            TrangThai = user.TrangThai,
            IsMetaMask = user.IsMetaMask,
            DiaChiVi = user.DiaChiVi,
            NgayThamGia = user.NgayThamGia,
            LanDangNhapCuoi = user.LanDangNhapCuoi
        };
    }
}

public sealed class DevelopmentAuthUser
{
    public int Id { get; set; }
    public string TenDangNhap { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string TenHienThi { get; set; } = string.Empty;
    public string VaiTro { get; set; } = "Nguoi Dung";
    public bool TrangThai { get; set; }
    public bool IsMetaMask { get; set; }
    public string? DiaChiVi { get; set; }
    public DateOnly NgayThamGia { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public DateOnly? LanDangNhapCuoi { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
}
