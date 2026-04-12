using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Services
{
    public class SessionKeyCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SessionKeyCleanupService> _logger;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(1);

        public SessionKeyCleanupService(
            IServiceProvider serviceProvider,
            ILogger<SessionKeyCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("SessionKeyCleanupService đang chạy...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupExpiredSessionKeys(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi xóa khóa phiên hết hạn: {Error}", ex.Message);
                }

                // Đợi đến lần chạy tiếp theo
                try
                {
                    await Task.Delay(_cleanupInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Service đang dừng, thoát khỏi vòng lặp
                    break;
                }
            }

            _logger.LogInformation("SessionKeyCleanupService đã dừng.");
        }

        private async Task CleanupExpiredSessionKeys(CancellationToken stoppingToken)
        {
            // Tạo scope để resolve các service
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Xác định thời gian xử lý
            var now = DateTime.UtcNow;
            var oneHourAgo = now.AddHours(-1);

            // Tìm các khóa phiên đã hết hạn (hơn 1 giờ trước)
            var expiredKeys = await dbContext.KhoaPhiens
                .Where(k => k.ThoiHan < oneHourAgo)
                .ToListAsync(stoppingToken);

            if (expiredKeys.Any())
            {
                _logger.LogInformation("Tìm thấy {Count} khóa phiên hết hạn, tiến hành xóa...", expiredKeys.Count);

                // Xóa các khóa phiên hết hạn
                dbContext.KhoaPhiens.RemoveRange(expiredKeys);

                // Lưu thay đổi vào cơ sở dữ liệu
                var deletedCount = await dbContext.SaveChangesAsync(stoppingToken);

                _logger.LogInformation("Đã xóa {DeletedCount} khóa phiên hết hạn khỏi cơ sở dữ liệu.", deletedCount);
            }
            else
            {
                _logger.LogInformation("Không tìm thấy khóa phiên hết hạn.");
            }
        }
    }
}