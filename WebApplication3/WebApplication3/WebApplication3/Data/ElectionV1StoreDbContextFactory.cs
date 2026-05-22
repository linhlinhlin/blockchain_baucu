using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WebApplication3.Data;

// Đợt 5 (spec 005): design-time factory cho phép `dotnet ef migrations add ...`
// trên ElectionV1StoreDbContext, để chuyển từ EnsureCreated sang EF migrations
// chuẩn cho PostgreSQL (giải quyết hạn chế: cột mới không được EnsureCreated thêm
// vào DB Postgres đang chạy — vd OtpAttemptCount/OtpLockedUntil từ Đợt 2).
// Chỉ dùng lúc design-time (dotnet ef); KHÔNG ảnh hưởng runtime.
public sealed class ElectionV1StoreDbContextFactory
    : IDesignTimeDbContextFactory<ElectionV1StoreDbContext>
{
    public ElectionV1StoreDbContext CreateDbContext(string[] args)
    {
        var connection =
            Environment.GetEnvironmentVariable("ElectionV1StoreConnection")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__ElectionV1StoreConnection")
            ?? "Host=localhost;Port=5432;Database=holihu_electionv1;Username=holihu;Password=holihu";

        var options = new DbContextOptionsBuilder<ElectionV1StoreDbContext>()
            .UseNpgsql(connection)
            .Options;

        return new ElectionV1StoreDbContext(options);
    }
}
