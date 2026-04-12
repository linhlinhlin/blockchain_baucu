using Microsoft.EntityFrameworkCore;
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace WebApplication3.Services
{
    /// <summary>
    /// Factory tạo DbContext mới cho các tác vụ bất đồng bộ
    /// </summary>
    /// <typeparam name="TContext">Loại DbContext</typeparam>
    public class TransientDbContextFactory<TContext> : IDbContextFactory<TContext> where TContext : DbContext
    {
        private readonly IServiceProvider _serviceProvider;

        public TransientDbContextFactory(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
        }

        /// <summary>
        /// Tạo một instance mới của DbContext
        /// </summary>
        public TContext CreateDbContext()
        {
            // Tạo scope mới để có thể tạo DbContext với lifetime scoped
            using var scope = _serviceProvider.CreateScope();
            return scope.ServiceProvider.GetRequiredService<TContext>();
        }

        /// <summary>
        /// Tạo một instance mới của DbContext (phiên bản async)
        /// </summary>
        public Task<TContext> CreateDbContextAsync(CancellationToken cancellationToken = default)
        {
            // Tạo scope mới để có thể tạo DbContext với lifetime scoped
            using var scope = _serviceProvider.CreateScope();
            return Task.FromResult(scope.ServiceProvider.GetRequiredService<TContext>());
        }
    }
}