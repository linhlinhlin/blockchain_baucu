using WebApplication3.Services;

namespace WebApplication3.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWalletLookupServices(this IServiceCollection services)
    {
        services.AddScoped<IBlockchainLookupService, BlockchainLookupService>();

        return services;
    }
}
