using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Infrastructure;

public sealed class DevelopmentAuthStore
{
    private readonly ElectionV1StoreDbContext _storeDbContext;

    public DevelopmentAuthStore(ElectionV1StoreDbContext storeDbContext)
    {
        _storeDbContext = storeDbContext;
    }

    public async Task EnsureSeedAsync(CancellationToken cancellationToken = default)
    {
        if (await _storeDbContext.DevelopmentAuthUsers.AnyAsync(cancellationToken))
        {
            await SyncSequenceAsync(cancellationToken);
            return;
        }

        _storeDbContext.DevelopmentAuthUsers.AddRange(
            new DevelopmentAuthUserRecord
            {
                TenDangNhap = "devadmin",
                Email = "devadmin@local.holihu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123", 12),
                TenHienThi = "Quan Tri Dev",
                VaiTro = "Quan Tri Vien",
                TrangThai = true,
                IsMetaMask = false
            },
            new DevelopmentAuthUserRecord
            {
                TenDangNhap = "devuser",
                Email = "devuser@local.holihu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("User@123", 12),
                TenHienThi = "Tai Khoan Dev",
                VaiTro = "Nguoi Dung",
                TrangThai = true,
                IsMetaMask = false
            });

        await _storeDbContext.SaveChangesAsync(cancellationToken);
        await SyncSequenceAsync(cancellationToken);
    }

    public async Task<bool> UsernameExistsAsync(string tenDangNhap, CancellationToken cancellationToken = default)
    {
        return await _storeDbContext.DevelopmentAuthUsers
            .AnyAsync(item => item.TenDangNhap.ToLower() == tenDangNhap.ToLower(), cancellationToken);
    }

    public async Task<IReadOnlyCollection<DevelopmentAuthUser>> SearchAsync(string? tenDangNhap, int? id, CancellationToken cancellationToken = default)
    {
        var query = _storeDbContext.DevelopmentAuthUsers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(tenDangNhap))
        {
            var normalized = tenDangNhap.Trim().ToLower();
            query = query.Where(item => item.TenDangNhap.ToLower().Contains(normalized));
        }

        if (id.HasValue)
        {
            query = query.Where(item => item.Id == id.Value);
        }

        var users = await query
            .OrderBy(item => item.Id)
            .ToListAsync(cancellationToken);

        return users.Select(ToDomain).ToList();
    }

    public async Task<DevelopmentAuthUser?> ValidateCredentialsAsync(string tenDangNhap, string matKhau, CancellationToken cancellationToken = default)
    {
        var normalized = tenDangNhap.Trim().ToLower();
        var user = await _storeDbContext.DevelopmentAuthUsers
            .FirstOrDefaultAsync(item => item.TenDangNhap.ToLower() == normalized, cancellationToken);

        if (user == null || !BCrypt.Net.BCrypt.Verify(matKhau, user.PasswordHash))
        {
            return null;
        }

        user.LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow);
        await _storeDbContext.SaveChangesAsync(cancellationToken);
        return ToDomain(user);
    }

    public async Task<DevelopmentAuthUser> RegisterAsync(
        string tenDangNhap,
        string email,
        string matKhau,
        string tenHienThi,
        CancellationToken cancellationToken = default)
    {
        if (await _storeDbContext.DevelopmentAuthUsers.AnyAsync(
                item => item.TenDangNhap.ToLower() == tenDangNhap.ToLower(),
                cancellationToken))
        {
            throw new InvalidOperationException("Tên đăng nhập đã được sử dụng");
        }

        if (await _storeDbContext.DevelopmentAuthUsers.AnyAsync(
                item => item.Email.ToLower() == email.ToLower(),
                cancellationToken))
        {
            throw new InvalidOperationException("Email đã được sử dụng");
        }

        var user = new DevelopmentAuthUserRecord
        {
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

        _storeDbContext.DevelopmentAuthUsers.Add(user);
        await _storeDbContext.SaveChangesAsync(cancellationToken);
        return ToDomain(user);
    }

    public async Task<DevelopmentAuthUser> LoginWithMetaMaskAsync(string diaChiVi, CancellationToken cancellationToken = default)
    {
        var normalized = diaChiVi.Trim();
        var user = await _storeDbContext.DevelopmentAuthUsers
            .FirstOrDefaultAsync(
                item => item.DiaChiVi != null && item.DiaChiVi.ToLower() == normalized.ToLower(),
                cancellationToken);

        if (user == null)
        {
            user = new DevelopmentAuthUserRecord
            {
                TenDangNhap = $"wallet_{Guid.NewGuid():N}"[..15],
                Email = $"{normalized[..8].ToLowerInvariant()}@local-wallet.holihu",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                TenHienThi = $"User_{normalized[2..8]}",
                VaiTro = "Nguoi Dung",
                TrangThai = true,
                IsMetaMask = true,
                DiaChiVi = normalized,
                NgayThamGia = DateOnly.FromDateTime(DateTime.UtcNow),
                LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            _storeDbContext.DevelopmentAuthUsers.Add(user);
        }
        else
        {
            user.LanDangNhapCuoi = DateOnly.FromDateTime(DateTime.UtcNow);
            user.IsMetaMask = true;
            user.DiaChiVi = normalized;
        }

        await _storeDbContext.SaveChangesAsync(cancellationToken);
        return ToDomain(user);
    }

    public async Task<DevelopmentAuthUser?> GetByIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        var user = await _storeDbContext.DevelopmentAuthUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        return user is null ? null : ToDomain(user);
    }

    public async Task StoreRefreshSessionAsync(
        int userId,
        string refreshToken,
        DateTime expiresAtUtc,
        string? ipAddress,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        var session = new DevelopmentAuthSessionRecord
        {
            UserId = userId,
            RefreshTokenHash = ComputeRefreshTokenHash(refreshToken),
            ExpiresAtUtc = expiresAtUtc,
            IpAddress = ipAddress,
            UserAgent = TrimToMaxLength(userAgent, 1024),
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true
        };

        _storeDbContext.DevelopmentAuthSessions.Add(session);
        await _storeDbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<DevelopmentAuthSessionLookupResult?> FindSessionByRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var tokenHash = ComputeRefreshTokenHash(refreshToken);
        var session = await _storeDbContext.DevelopmentAuthSessions
            .Include(item => item.User)
            .FirstOrDefaultAsync(item => item.RefreshTokenHash == tokenHash && item.IsActive, cancellationToken);

        if (session?.User == null)
        {
            return null;
        }

        return new DevelopmentAuthSessionLookupResult
        {
            SessionId = session.Id,
            ExpiresAtUtc = session.ExpiresAtUtc,
            User = ToDomain(session.User)
        };
    }

    public async Task RevokeRefreshSessionAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var tokenHash = ComputeRefreshTokenHash(refreshToken);
        var session = await _storeDbContext.DevelopmentAuthSessions
            .FirstOrDefaultAsync(item => item.RefreshTokenHash == tokenHash && item.IsActive, cancellationToken);
        if (session == null)
        {
            return;
        }

        session.IsActive = false;
        session.RevokedAtUtc = DateTime.UtcNow;
        await _storeDbContext.SaveChangesAsync(cancellationToken);
    }

    private Task SyncSequenceAsync(CancellationToken cancellationToken = default)
    {
        if (!string.Equals(
                _storeDbContext.Database.ProviderName,
                "Npgsql.EntityFrameworkCore.PostgreSQL",
                StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        // PostgreSQL sequences are not auto-advanced when rows are inserted with explicit PK values.
        // This call forces the sequence to the current MAX(Id) so subsequent auto-generated inserts
        // do not collide with existing rows.
        const string sql = """
            SELECT setval(
                pg_get_serial_sequence('"DevelopmentAuthUser"', 'Id'),
                COALESCE(MAX("Id"), 0)
            )
            FROM "DevelopmentAuthUser"
            """;
        return _storeDbContext.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }

    private static string ComputeRefreshTokenHash(string refreshToken)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(hash);
    }

    private static string? TrimToMaxLength(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return value.Length <= maxLength ? value : value[..maxLength];
    }

    private static DevelopmentAuthUser ToDomain(DevelopmentAuthUserRecord record)
    {
        return new DevelopmentAuthUser
        {
            Id = record.Id,
            TenDangNhap = record.TenDangNhap,
            Email = record.Email,
            PasswordHash = record.PasswordHash,
            TenHienThi = record.TenHienThi,
            VaiTro = record.VaiTro,
            TrangThai = record.TrangThai,
            IsMetaMask = record.IsMetaMask,
            DiaChiVi = record.DiaChiVi,
            NgayThamGia = record.NgayThamGia,
            LanDangNhapCuoi = record.LanDangNhapCuoi
        };
    }
}

public sealed class DevelopmentAuthSessionLookupResult
{
    public int SessionId { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DevelopmentAuthUser User { get; set; } = new();
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
