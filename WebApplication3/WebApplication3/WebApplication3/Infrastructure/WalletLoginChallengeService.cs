using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Caching.Distributed;

namespace WebApplication3.Infrastructure;

public sealed class WalletLoginChallengeService
{
    private static readonly TimeSpan ChallengeTtl = TimeSpan.FromMinutes(5);
    private readonly IDistributedCache _cache;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _consumeLocks = new();

    public WalletLoginChallengeService(IDistributedCache cache)
    {
        _cache = cache;
    }

    public async Task<WalletLoginChallenge> CreateAsync(
        string normalizedWalletAddress,
        CancellationToken cancellationToken = default)
    {
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var issuedAtUtc = DateTimeOffset.UtcNow;
        var expiresAtUtc = issuedAtUtc.Add(ChallengeTtl);
        var message = BuildMessage(normalizedWalletAddress, nonce, issuedAtUtc, expiresAtUtc);

        await _cache.SetStringAsync(
            BuildCacheKey(normalizedWalletAddress, message),
            expiresAtUtc.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture),
            new DistributedCacheEntryOptions { AbsoluteExpiration = expiresAtUtc },
            cancellationToken);

        return new WalletLoginChallenge
        {
            DiaChiVi = normalizedWalletAddress,
            Nonce = nonce,
            Message = message,
            ExpiresAtUtc = expiresAtUtc
        };
    }

    public async Task<bool> ConsumeAsync(
        string normalizedWalletAddress,
        string signedMessage,
        CancellationToken cancellationToken = default)
    {
        var key = BuildCacheKey(normalizedWalletAddress, signedMessage);
        var gate = _consumeLocks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));

        await gate.WaitAsync(cancellationToken);
        try
        {
            var cached = await _cache.GetStringAsync(key, cancellationToken);
            if (string.IsNullOrWhiteSpace(cached))
            {
                return false;
            }

            if (!long.TryParse(cached, NumberStyles.Integer, CultureInfo.InvariantCulture, out var expiresAtUnix) ||
                DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiresAtUnix)
            {
                await _cache.RemoveAsync(key, cancellationToken);
                return false;
            }

            await _cache.RemoveAsync(key, cancellationToken);
            return true;
        }
        finally
        {
            gate.Release();
            _consumeLocks.TryRemove(key, out _);
        }
    }

    private static string BuildMessage(
        string normalizedWalletAddress,
        string nonce,
        DateTimeOffset issuedAtUtc,
        DateTimeOffset expiresAtUtc)
    {
        return string.Join(
            "\n",
            "HoLiHu BlockVote Login",
            $"Address: {normalizedWalletAddress}",
            $"Nonce: {nonce}",
            $"Issued At: {issuedAtUtc:O}",
            $"Expires At: {expiresAtUtc:O}");
    }

    private static string BuildCacheKey(string normalizedWalletAddress, string message)
    {
        var material = $"{normalizedWalletAddress}\n{message}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(material));
        return $"wallet-login-challenge:{normalizedWalletAddress}:{Convert.ToHexString(hash)}";
    }
}

public sealed class WalletLoginChallenge
{
    public string DiaChiVi { get; init; } = string.Empty;
    public string Nonce { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; init; }
}
