using WebApplication3.Services;

namespace WebApplication3.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddLegacyBlockchainStack(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var settings = new LegacyBlockchainSettings();
        configuration.GetSection("LegacyBlockchainSettings").Bind(settings);

        services.AddScoped<SessionService>();
        services.AddScoped<BlockchainServerService>();
        services.AddSingleton<BundlerService>();
        services.AddSingleton<BlockchainService>();
        services.AddScoped<IBlockchainLookupService, BlockchainLookupService>();

        if (!settings.Enabled)
        {
            return services;
        }

        services.AddHostedService<BlockchainEventListenerService>();
        services.AddHostedService<SessionKeyCleanupService>();

        return services;
    }
}
