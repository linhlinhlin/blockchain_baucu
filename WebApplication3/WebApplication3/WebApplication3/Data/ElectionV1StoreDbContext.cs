using Microsoft.EntityFrameworkCore;
using WebApplication3.Models;

namespace WebApplication3.Data;

public sealed class ElectionV1StoreDbContext : DbContext
{
    public ElectionV1StoreDbContext(DbContextOptions<ElectionV1StoreDbContext> options)
        : base(options)
    {
    }

    public DbSet<ElectionV1RosterDraftRecord> ElectionV1RosterDrafts => Set<ElectionV1RosterDraftRecord>();
    public DbSet<ElectionV1RosterInviteRecord> ElectionV1RosterInvites => Set<ElectionV1RosterInviteRecord>();
    public DbSet<DevelopmentAuthUserRecord> DevelopmentAuthUsers => Set<DevelopmentAuthUserRecord>();
    public DbSet<DevelopmentAuthSessionRecord> DevelopmentAuthSessions => Set<DevelopmentAuthSessionRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ElectionV1RosterDraftRecord>(entity =>
        {
            entity.ToTable("ElectionV1RosterDraft");
            entity.HasKey(item => item.GroupKey);

            entity.Property(item => item.GroupKey).HasMaxLength(200);
            entity.Property(item => item.AdminWalletAddress).HasMaxLength(42).IsRequired();
            entity.Property(item => item.Title).HasMaxLength(255).IsRequired();
            entity.Property(item => item.Status).HasMaxLength(32).IsRequired();
            entity.Property(item => item.PositionsJson).IsRequired();
            entity.Property(item => item.Description).HasMaxLength(2000);

            entity.HasMany(item => item.Invites)
                .WithOne(item => item.Draft)
                .HasForeignKey(item => item.GroupKey)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ElectionV1RosterInviteRecord>(entity =>
        {
            entity.ToTable("ElectionV1RosterInvite");
            entity.HasKey(item => item.Id);

            entity.Property(item => item.GroupKey).HasMaxLength(200).IsRequired();
            entity.Property(item => item.InviteId).HasMaxLength(80).IsRequired();
            entity.Property(item => item.Token).HasMaxLength(255).IsRequired();
            entity.Property(item => item.FullName).HasMaxLength(255).IsRequired();
            entity.Property(item => item.Email).HasMaxLength(255).IsRequired();
            entity.Property(item => item.StudentCode).HasMaxLength(64);
            entity.Property(item => item.InviteUrl).HasMaxLength(2048).IsRequired();
            entity.Property(item => item.QrPayload).HasMaxLength(2048).IsRequired();
            entity.Property(item => item.LastOtpCode).HasMaxLength(12);
            entity.Property(item => item.WalletAddress).HasMaxLength(42);

            entity.HasIndex(item => item.Token).IsUnique();
            entity.HasIndex(item => new { item.GroupKey, item.InviteId }).IsUnique();
        });

        modelBuilder.Entity<DevelopmentAuthUserRecord>(entity =>
        {
            entity.ToTable("DevelopmentAuthUser");
            entity.HasKey(item => item.Id);

            entity.Property(item => item.TenDangNhap).HasMaxLength(128).IsRequired();
            entity.Property(item => item.Email).HasMaxLength(255).IsRequired();
            entity.Property(item => item.PasswordHash).HasMaxLength(255).IsRequired();
            entity.Property(item => item.TenHienThi).HasMaxLength(255).IsRequired();
            entity.Property(item => item.VaiTro).HasMaxLength(64).IsRequired();
            entity.Property(item => item.DiaChiVi).HasMaxLength(42);

            entity.HasIndex(item => item.TenDangNhap).IsUnique();
            entity.HasIndex(item => item.Email).IsUnique();
            entity.HasIndex(item => item.DiaChiVi).IsUnique();

            entity.HasMany(item => item.Sessions)
                .WithOne(item => item.User)
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DevelopmentAuthSessionRecord>(entity =>
        {
            entity.ToTable("DevelopmentAuthSession");
            entity.HasKey(item => item.Id);

            entity.Property(item => item.RefreshTokenHash).HasMaxLength(128).IsRequired();
            entity.Property(item => item.IpAddress).HasMaxLength(128);
            entity.Property(item => item.UserAgent).HasMaxLength(1024);

            entity.HasIndex(item => item.RefreshTokenHash).IsUnique();
            entity.HasIndex(item => new { item.UserId, item.IsActive });
        });
    }
}
