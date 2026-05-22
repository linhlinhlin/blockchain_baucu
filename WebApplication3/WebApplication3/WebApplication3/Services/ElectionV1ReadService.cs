using System.Globalization;
using System.Numerics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Util;
using Nethereum.Web3;
using Newtonsoft.Json;

namespace WebApplication3.Services;

public sealed class ElectionV1ReadService
{
    private const string ZeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
    private const string ElectionV1Abi = """
    [
      {"type":"function","name":"currentPhase","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]},
      {"type":"function","name":"owner","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"address"}]},
      {"type":"function","name":"totalCommits","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
      {"type":"function","name":"totalReveals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
      {"type":"function","name":"finalized","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"bool"}]},
      {"type":"function","name":"canceled","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"bool"}]},
      {"type":"function","name":"voteCounts","stateMutability":"view","inputs":[{"name":"","type":"bytes32"}],"outputs":[{"name":"","type":"uint256"}]},
      {"type":"function","name":"commitments","stateMutability":"view","inputs":[{"name":"","type":"address"}],"outputs":[{"name":"","type":"bytes32"}]},
      {"type":"function","name":"hasRevealed","stateMutability":"view","inputs":[{"name":"","type":"address"}],"outputs":[{"name":"","type":"bool"}]}
    ]
    """;

    private static readonly IReadOnlyDictionary<int, string> PhaseLabels = new Dictionary<int, string>
    {
        [0] = "Pending",
        [1] = "Commit",
        [2] = "Reveal",
        [3] = "Ended",
        [4] = "Finalized",
        [5] = "Canceled"
    };

    private readonly ILogger<ElectionV1ReadService> _logger;
    private readonly string _deploymentsDirectory;
    private readonly string _factoryLatestPath;
    private readonly string? _configuredFactoryAddress;
    private readonly string _rpcUrl;
    private readonly string _explorerBaseUrl;
    private readonly int _chainId;

    public ElectionV1ReadService(IConfiguration configuration, IWebHostEnvironment environment, ILogger<ElectionV1ReadService> logger)
    {
        _logger = logger;

        var contentRoot = environment.ContentRootPath;
        var contractsRootPath = ElectionV1Workspace.ResolveContractsRootPath(
            configuration["ElectionV1Settings:ContractsRootPath"],
            contentRoot);
        _deploymentsDirectory = ElectionV1Workspace.ResolvePathFromContractsRoot(
            contractsRootPath,
            configuration["ElectionV1Settings:DeploymentsPath"],
            "deployments",
            "sepolia");
        _factoryLatestPath = ElectionV1Workspace.ResolvePathFromContractsRoot(
            contractsRootPath,
            configuration["ElectionV1Settings:FactoryLatestPath"],
            "deployments",
            "sepolia",
            "factory-latest.json");
        _configuredFactoryAddress =
            configuration["ElectionV1Settings:FactoryAddress"] ??
            configuration["FACTORY_ADDRESS"];
        _rpcUrl = configuration["ElectionV1Settings:RpcUrl"] ?? "https://ethereum-sepolia-rpc.publicnode.com";
        _explorerBaseUrl = configuration["ElectionV1Settings:ExplorerBaseUrl"] ?? "https://sepolia.etherscan.io";
        _chainId = int.TryParse(configuration["ElectionV1Settings:ChainId"], out var parsedChainId)
            ? parsedChainId
            : 11155111;
    }

    public ElectionV1PublicConfigDto GetPublicConfig()
    {
        return new ElectionV1PublicConfigDto
        {
            ChainId = _chainId,
            ExplorerBaseUrl = _explorerBaseUrl,
            FactoryAddress = LoadFactoryAddress(),
            RpcUrl = _rpcUrl
        };
    }

    public IReadOnlyList<ElectionV1ListItemDto> ListElections()
    {
        return LoadRecords()
            .Select(ToListItem)
            .ToList();
    }

    public IReadOnlyList<ElectionV1GroupListItemDto> ListElectionGroups(string? viewerAddress = null)
    {
        var normalizedViewer = NormalizeOptionalAddress(viewerAddress);
        return LoadRecords()
            .GroupBy(ResolveGroupKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => ToGroupListItem(group.Key, group.ToList(), normalizedViewer))
            .OrderBy(item => GetPhasePriority(item.CommitStart, item.CommitEnd, item.RevealEnd))
            .ThenByDescending(item => item.BlockNumber)
            .ToList();
    }

    public async Task<ElectionV1DetailDto?> GetElectionAsync(string identifier, string? viewerAddress = null)
    {
        var record = ResolveRecord(identifier);
        if (record is null)
        {
            return null;
        }

        ElectionV1OnChainStateDto onChain;
        try
        {
            onChain = await LoadOnChainStateAsync(record, viewerAddress);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Khong the tai on-chain state cho election {ElectionAddress}. Su dung fallback state.", record.Address);
            onChain = BuildFallbackOnChainState(record, viewerAddress);
        }

        return new ElectionV1DetailDto
        {
            Address = record.Address,
            Admin = record.Admin,
            Title = record.Title,
            Description = record.Description,
            ElectionKey = record.ElectionKey,
            CommitStart = record.CommitStart,
            CommitEnd = record.CommitEnd,
            RevealEnd = record.RevealEnd,
            VoterCount = record.VoterCount,
            Candidates = record.Candidates,
            BlockNumber = record.BlockNumber,
            TxHash = record.TxHash,
            CreatedAt = record.CreatedAt,
            Links = BuildLinks(record.Address, record.TxHash),
            Manifest = record.Manifest,
            Summary = record.Summary,
            OnChain = onChain
        };
    }

    public ElectionV1ProofDto? GetProof(string identifier, string address)
    {
        var record = ResolveRecord(identifier);
        if (record is null)
        {
            return null;
        }

        var normalizedAddress = NormalizeAddress(address);
        var proof = record.Eligibility?.Proofs?
            .FirstOrDefault(item => string.Equals(NormalizeAddress(item.Key), normalizedAddress, StringComparison.OrdinalIgnoreCase))
            .Value;

        return new ElectionV1ProofDto
        {
            Address = normalizedAddress,
            Eligible = proof is not null,
            Proof = proof ?? new List<string>()
        };
    }

    public ElectionV1GroupDetailDto? GetElectionGroup(string identifier, string? viewerAddress = null)
    {
        var normalizedIdentifier = identifier.Trim();
        var normalizedViewer = NormalizeOptionalAddress(viewerAddress);
        var records = LoadRecords()
            .GroupBy(ResolveGroupKey, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group =>
                string.Equals(group.Key, normalizedIdentifier, StringComparison.OrdinalIgnoreCase)
                || string.Equals(group.FirstOrDefault()?.GroupTitle, normalizedIdentifier, StringComparison.OrdinalIgnoreCase)
                || string.Equals(group.FirstOrDefault()?.ElectionKey, normalizedIdentifier, StringComparison.OrdinalIgnoreCase));

        if (records is null)
        {
            return null;
        }

        var items = records.ToList();
        var first = items[0];
        return new ElectionV1GroupDetailDto
        {
            GroupKey = records.Key,
            Title = first.GroupTitle ?? first.Title,
            Description = first.GroupDescription ?? first.Description,
            Admin = first.Admin,
            CommitStart = items.Min(item => item.CommitStart),
            CommitEnd = items.Max(item => item.CommitEnd),
            RevealEnd = items.Max(item => item.RevealEnd),
            VoterCount = items.Max(item => item.VoterCount),
            PositionCount = items.Count,
            BlockNumber = items.Max(item => item.BlockNumber),
            CreatedAt = items.OrderBy(item => item.CreatedAt).Select(item => item.CreatedAt).FirstOrDefault(),
            ViewerRole = ResolveViewerRole(first.Admin, items, normalizedViewer),
            ViewerEligiblePositionCount = CountEligiblePositions(items, normalizedViewer),
            Positions = items
                .OrderBy(item => item.BallotOrder)
                .ThenBy(item => item.Title)
                .Select(ToListItem)
                .ToList()
        };
    }

    private ElectionV1LinksDto BuildLinks(string address, string txHash)
    {
        return new ElectionV1LinksDto
        {
            Contract = $"{_explorerBaseUrl}/address/{address}",
            Transaction = $"{_explorerBaseUrl}/tx/{txHash}"
        };
    }

    private string? LoadFactoryAddress()
    {
        if (!File.Exists(_factoryLatestPath))
        {
            return NormalizeConfiguredFactoryAddress();
        }

        try
        {
            var raw = JsonConvert.DeserializeObject<ElectionV1FactoryRecord>(File.ReadAllText(_factoryLatestPath));
            return raw?.Address is null ? NormalizeConfiguredFactoryAddress() : NormalizeAddress(raw.Address);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Khong the doc factory latest record tu {FactoryLatestPath}", _factoryLatestPath);
            return NormalizeConfiguredFactoryAddress();
        }
    }

    private string? NormalizeConfiguredFactoryAddress()
    {
        if (string.IsNullOrWhiteSpace(_configuredFactoryAddress))
        {
            return null;
        }

        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(_configuredFactoryAddress))
        {
            _logger.LogWarning("ElectionV1 factory address tu cau hinh khong hop le.");
            return null;
        }

        return AddressUtil.Current.ConvertToChecksumAddress(_configuredFactoryAddress);
    }

    private ElectionV1NormalizedRecord? ResolveRecord(string identifier)
    {
        var normalizedIdentifier = identifier.Trim();
        return LoadRecords().FirstOrDefault(record =>
            string.Equals(record.Address, normalizedIdentifier, StringComparison.OrdinalIgnoreCase)
            || string.Equals(record.Title, normalizedIdentifier, StringComparison.OrdinalIgnoreCase)
            || string.Equals(record.ElectionId, normalizedIdentifier, StringComparison.OrdinalIgnoreCase));
    }

    private IReadOnlyList<ElectionV1NormalizedRecord> LoadRecords()
    {
        if (!Directory.Exists(_deploymentsDirectory))
        {
            return Array.Empty<ElectionV1NormalizedRecord>();
        }

        var byAddress = new Dictionary<string, ElectionV1NormalizedRecord>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in Directory.GetFiles(_deploymentsDirectory, "election-*.json"))
        {
            var raw = JsonConvert.DeserializeObject<ElectionV1DeploymentRecord>(File.ReadAllText(file));
            if (raw?.ElectionAddress is null || raw.Config is null)
            {
                continue;
            }

            var normalized = NormalizeRecord(raw, file);
            byAddress[normalized.Address] = normalized;
        }

        return byAddress.Values
            .OrderBy(record => GetPhasePriority(record))
            .ThenByDescending(record => record.BlockNumber)
            .ToList();
    }

    private static int GetPhasePriority(ElectionV1NormalizedRecord record)
    {
        return GetPhasePriority(record.CommitStart, record.CommitEnd, record.RevealEnd);
    }

    private static int GetPhasePriority(long commitStart, long commitEnd, long revealEnd)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (now < commitStart)
        {
            return 1;
        }

        if (now < commitEnd)
        {
            return 0;
        }

        if (now < revealEnd)
        {
            return 2;
        }

        return 3;
    }

    private ElectionV1NormalizedRecord NormalizeRecord(ElectionV1DeploymentRecord raw, string filePath)
    {
        var manifest = raw.Manifest ?? ParseManifestDataUri(raw.Config?.ElectionURI);
        var summary = raw.Summary;
        var config = raw.Config ?? new ElectionV1Config();
        var configuredCandidateIds = config.CandidateIds ?? new List<string>();
        var manifestCandidates = manifest?.Candidates ?? new List<ElectionV1ManifestCandidate>();
        var candidates = new List<ElectionV1CandidateDto>();

        if (manifestCandidates.Count > 0)
        {
            for (var index = 0; index < manifestCandidates.Count; index++)
            {
                var candidate = manifestCandidates[index];
                candidates.Add(new ElectionV1CandidateDto
                {
                    CandidateId = candidate.CandidateId ?? configuredCandidateIds.ElementAtOrDefault(index) ?? string.Empty,
                    DisplayName = candidate.Name ?? candidate.DisplayName ?? $"Candidate {index + 1}",
                    SourceId = candidate.Id ?? candidate.SourceId,
                    WalletAddress = candidate.WalletAddress
                });
            }
        }
        else
        {
            for (var index = 0; index < configuredCandidateIds.Count; index++)
            {
                candidates.Add(new ElectionV1CandidateDto
                {
                    CandidateId = configuredCandidateIds[index],
                    DisplayName = $"Candidate {index + 1}"
                });
            }
        }

        return new ElectionV1NormalizedRecord
        {
            Address = NormalizeAddress(raw.ElectionAddress!),
            Admin = NormalizeAddress(config.Admin ?? raw.RequesterAddress ?? string.Empty),
            BallotOrder = manifest?.BallotOrder ?? 0,
            BlockNumber = raw.BlockNumber,
            CommitStart = config.CommitStart,
            CommitEnd = config.CommitEnd,
            RevealEnd = config.RevealEnd,
            CreatedAt = raw.CreatedAt,
            ElectionId = raw.ElectionId ?? string.Empty,
            ElectionKey = manifest?.ElectionKey,
            GroupDescription = manifest?.GroupDescription,
            GroupKey = manifest?.GroupKey,
            GroupTitle = manifest?.GroupTitle,
            Summary = summary,
            Manifest = manifest,
            Eligibility = raw.Eligibility,
            PositionDescription = manifest?.PositionDescription,
            PositionId = manifest?.PositionId,
            PositionTitle = manifest?.PositionTitle,
            RecordPath = filePath,
            Title = manifest?.PositionTitle ?? manifest?.Title ?? "Untitled Election",
            Description = manifest?.PositionDescription ?? manifest?.Description ?? string.Empty,
            TxHash = raw.TxHash ?? string.Empty,
            VoterCount = summary?.VoterCount ?? manifest?.VoterCount ?? 0,
            Candidates = candidates
        };
    }

    private async Task<ElectionV1OnChainStateDto> LoadOnChainStateAsync(ElectionV1NormalizedRecord record, string? viewerAddress)
    {
        var web3 = new Web3(_rpcUrl);
        var contract = web3.Eth.GetContract(ElectionV1Abi, record.Address);

        var currentPhase = await contract.GetFunction("currentPhase").CallAsync<BigInteger>();
        var owner = await contract.GetFunction("owner").CallAsync<string>();
        var totalCommits = await contract.GetFunction("totalCommits").CallAsync<BigInteger>();
        var totalReveals = await contract.GetFunction("totalReveals").CallAsync<BigInteger>();
        var finalized = await contract.GetFunction("finalized").CallAsync<bool>();
        var canceled = await contract.GetFunction("canceled").CallAsync<bool>();

        ElectionV1ViewerStateDto? viewer = null;
        if (!string.IsNullOrWhiteSpace(viewerAddress))
        {
            var normalizedViewer = NormalizeAddress(viewerAddress);
            var proof = GetProof(record.Address, normalizedViewer);
            var commitmentBytes = await contract.GetFunction("commitments").CallAsync<byte[]>(normalizedViewer);
            var hasRevealed = await contract.GetFunction("hasRevealed").CallAsync<bool>(normalizedViewer);
            var commitment = ToBytes32Hex(commitmentBytes);
            viewer = new ElectionV1ViewerStateDto
            {
                Address = normalizedViewer,
                Eligible = proof?.Eligible ?? false,
                HasCommitted = !string.Equals(commitment, ZeroBytes32, StringComparison.OrdinalIgnoreCase),
                HasRevealed = hasRevealed,
                Commitment = string.Equals(commitment, ZeroBytes32, StringComparison.OrdinalIgnoreCase) ? null : commitment,
                ProofAvailable = proof?.Eligible ?? false
            };
        }

        var resultItems = new List<ElectionV1ResultDto>();
        var voteCountsFunction = contract.GetFunction("voteCounts");
        for (var index = 0; index < record.Candidates.Count; index++)
        {
            var candidate = record.Candidates[index];
            var count = await voteCountsFunction.CallAsync<BigInteger>(candidate.CandidateId.HexToByteArray());
            resultItems.Add(new ElectionV1ResultDto
            {
                CandidateIndex = index,
                CandidateId = candidate.CandidateId,
                CandidateName = candidate.DisplayName ?? $"Candidate {index + 1}",
                CandidateSourceId = candidate.SourceId,
                CandidateWalletAddress = candidate.WalletAddress,
                Count = (long)count
            });
        }

        var phaseValue = (int)currentPhase;
        return new ElectionV1OnChainStateDto
        {
            Address = record.Address,
            Owner = NormalizeAddress(owner),
            Phase = phaseValue,
            PhaseLabel = PhaseLabels.TryGetValue(phaseValue, out var label) ? label : "Unknown",
            Finalized = finalized,
            Canceled = canceled,
            CommitStart = record.CommitStart,
            CommitEnd = record.CommitEnd,
            RevealEnd = record.RevealEnd,
            TotalCommits = totalCommits.ToString(CultureInfo.InvariantCulture),
            TotalReveals = totalReveals.ToString(CultureInfo.InvariantCulture),
            Results = resultItems,
            Viewer = viewer
        };
    }

    private ElectionV1OnChainStateDto BuildFallbackOnChainState(ElectionV1NormalizedRecord record, string? viewerAddress)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var phaseValue = now < record.CommitStart
            ? 0
            : now < record.CommitEnd
                ? 1
                : now < record.RevealEnd
                    ? 2
                    : 3;

        var viewerProof = !string.IsNullOrWhiteSpace(viewerAddress)
            ? GetProof(record.Address, viewerAddress)
            : null;

        return new ElectionV1OnChainStateDto
        {
            Address = record.Address,
            Owner = record.Admin,
            Phase = phaseValue,
            PhaseLabel = PhaseLabels.TryGetValue(phaseValue, out var label) ? label : "Unknown",
            Finalized = false,
            Canceled = false,
            CommitStart = record.CommitStart,
            CommitEnd = record.CommitEnd,
            RevealEnd = record.RevealEnd,
            TotalCommits = "0",
            TotalReveals = "0",
            Results = record.Candidates.Select((candidate, index) => new ElectionV1ResultDto
            {
                CandidateIndex = index,
                CandidateId = candidate.CandidateId,
                CandidateName = candidate.DisplayName ?? $"Candidate {index + 1}",
                CandidateSourceId = candidate.SourceId,
                CandidateWalletAddress = candidate.WalletAddress,
                Count = 0
            }).ToList(),
            Viewer = string.IsNullOrWhiteSpace(viewerAddress)
                ? null
                : new ElectionV1ViewerStateDto
                {
                    Address = NormalizeAddress(viewerAddress),
                    Eligible = viewerProof?.Eligible ?? false,
                    HasCommitted = false,
                    HasRevealed = false,
                    Commitment = null,
                    ProofAvailable = viewerProof?.Eligible ?? false
                }
        };
    }

    private static ElectionV1Manifest? ParseManifestDataUri(string? uri)
    {
        const string prefix = "data:application/json;utf8,";
        if (string.IsNullOrWhiteSpace(uri) || !uri.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var json = Uri.UnescapeDataString(uri[prefix.Length..]);
        return JsonConvert.DeserializeObject<ElectionV1Manifest>(json);
    }

    private static string NormalizeAddress(string address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return string.Empty;
        }

        return AddressUtil.Current.IsValidEthereumAddressHexFormat(address)
            ? AddressUtil.Current.ConvertToChecksumAddress(address)
            : address;
    }

    private static string? NormalizeOptionalAddress(string? address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return null;
        }

        return NormalizeAddress(address);
    }

    private static bool HasEligibilityProof(ElectionV1NormalizedRecord record, string normalizedViewer)
    {
        return record.Eligibility?.Proofs?.Keys.Any(address =>
            string.Equals(NormalizeAddress(address), normalizedViewer, StringComparison.OrdinalIgnoreCase)) ?? false;
    }

    private static int CountEligiblePositions(
        IReadOnlyList<ElectionV1NormalizedRecord> records,
        string? normalizedViewer)
    {
        if (string.IsNullOrWhiteSpace(normalizedViewer))
        {
            return 0;
        }

        return records.Count(record => HasEligibilityProof(record, normalizedViewer));
    }

    private static string ResolveViewerRole(
        string adminAddress,
        IReadOnlyList<ElectionV1NormalizedRecord> records,
        string? normalizedViewer)
    {
        if (string.IsNullOrWhiteSpace(normalizedViewer))
        {
            return "unknown";
        }

        if (string.Equals(NormalizeAddress(adminAddress), normalizedViewer, StringComparison.OrdinalIgnoreCase))
        {
            return "owner";
        }

        return CountEligiblePositions(records, normalizedViewer) > 0 ? "voter" : "observer";
    }

    private static string ToBytes32Hex(byte[]? value)
    {
        if (value is null || value.Length == 0)
        {
            return ZeroBytes32;
        }

        return value.ToHex(true);
    }

    private ElectionV1ListItemDto ToListItem(ElectionV1NormalizedRecord record)
    {
        return new ElectionV1ListItemDto
        {
            Address = record.Address,
            Admin = record.Admin,
            BallotOrder = record.BallotOrder,
            Title = record.Title,
            Description = record.Description,
            ElectionKey = record.ElectionKey,
            GroupKey = record.GroupKey,
            GroupTitle = record.GroupTitle,
            PositionId = record.PositionId,
            PositionTitle = record.PositionTitle,
            CommitStart = record.CommitStart,
            CommitEnd = record.CommitEnd,
            RevealEnd = record.RevealEnd,
            VoterCount = record.VoterCount,
            Candidates = record.Candidates,
            BlockNumber = record.BlockNumber,
            TxHash = record.TxHash,
            CreatedAt = record.CreatedAt,
            Links = BuildLinks(record.Address, record.TxHash)
        };
    }

    private static string ResolveGroupKey(ElectionV1NormalizedRecord record)
    {
        if (!string.IsNullOrWhiteSpace(record.GroupKey))
        {
            return record.GroupKey;
        }

        if (!string.IsNullOrWhiteSpace(record.ElectionKey))
        {
            return record.ElectionKey;
        }

        return record.Address;
    }

    private ElectionV1GroupListItemDto ToGroupListItem(
        string groupKey,
        IReadOnlyList<ElectionV1NormalizedRecord> records,
        string? normalizedViewer)
    {
        var first = records[0];
        return new ElectionV1GroupListItemDto
        {
            GroupKey = groupKey,
            Title = first.GroupTitle ?? first.Title,
            Description = first.GroupDescription ?? first.Description,
            Admin = first.Admin,
            CommitStart = records.Min(item => item.CommitStart),
            CommitEnd = records.Max(item => item.CommitEnd),
            RevealEnd = records.Max(item => item.RevealEnd),
            VoterCount = records.Max(item => item.VoterCount),
            PositionCount = records.Count,
            BlockNumber = records.Max(item => item.BlockNumber),
            CreatedAt = records.OrderBy(item => item.CreatedAt).Select(item => item.CreatedAt).FirstOrDefault(),
            ViewerRole = ResolveViewerRole(first.Admin, records, normalizedViewer),
            ViewerEligiblePositionCount = CountEligiblePositions(records, normalizedViewer),
            Positions = records
                .OrderBy(item => item.BallotOrder)
                .ThenBy(item => item.Title)
                .Select(ToListItem)
                .ToList()
        };
    }

}

public sealed class ElectionV1PublicConfigDto
{
    public int ChainId { get; set; }
    public string? ExplorerBaseUrl { get; set; }
    public string? FactoryAddress { get; set; }
    public string? RpcUrl { get; set; }
}

public sealed class ElectionV1ListResponseDto
{
    public IReadOnlyList<ElectionV1ListItemDto> Items { get; set; } = Array.Empty<ElectionV1ListItemDto>();
}

public class ElectionV1ListItemDto
{
    public string Address { get; set; } = string.Empty;
    public string Admin { get; set; } = string.Empty;
    public int BallotOrder { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? ElectionKey { get; set; }
    public string? GroupKey { get; set; }
    public string? GroupTitle { get; set; }
    public string? PositionId { get; set; }
    public string? PositionTitle { get; set; }
    public long CommitStart { get; set; }
    public long CommitEnd { get; set; }
    public long RevealEnd { get; set; }
    public int VoterCount { get; set; }
    public IReadOnlyList<ElectionV1CandidateDto> Candidates { get; set; } = Array.Empty<ElectionV1CandidateDto>();
    public long BlockNumber { get; set; }
    public string TxHash { get; set; } = string.Empty;
    public string? CreatedAt { get; set; }
    public ElectionV1LinksDto? Links { get; set; }
}

public sealed class ElectionV1DetailDto : ElectionV1ListItemDto
{
    public ElectionV1Manifest? Manifest { get; set; }
    public ElectionV1Summary? Summary { get; set; }
    public ElectionV1OnChainStateDto? OnChain { get; set; }
}

public sealed class ElectionV1GroupListResponseDto
{
    public IReadOnlyList<ElectionV1GroupListItemDto> Items { get; set; } = Array.Empty<ElectionV1GroupListItemDto>();
}

public class ElectionV1GroupListItemDto
{
    public string GroupKey { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Admin { get; set; } = string.Empty;
    public long CommitStart { get; set; }
    public long CommitEnd { get; set; }
    public long RevealEnd { get; set; }
    public int VoterCount { get; set; }
    public int PositionCount { get; set; }
    public long BlockNumber { get; set; }
    public string? CreatedAt { get; set; }
    public string ViewerRole { get; set; } = "unknown";
    public int ViewerEligiblePositionCount { get; set; }
    public IReadOnlyList<ElectionV1ListItemDto> Positions { get; set; } = Array.Empty<ElectionV1ListItemDto>();
}

public sealed class ElectionV1GroupDetailDto : ElectionV1GroupListItemDto
{
}

public sealed class ElectionV1ProofDto
{
    public string Address { get; set; } = string.Empty;
    public bool Eligible { get; set; }
    public IReadOnlyList<string> Proof { get; set; } = Array.Empty<string>();
}

public sealed class ElectionV1LinksDto
{
    public string? Contract { get; set; }
    public string? Transaction { get; set; }
}

public sealed class ElectionV1CandidateDto
{
    public string CandidateId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? SourceId { get; set; }
    public string? WalletAddress { get; set; }
}

public sealed class ElectionV1OnChainStateDto
{
    public string Address { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public int Phase { get; set; }
    public string PhaseLabel { get; set; } = string.Empty;
    public bool Finalized { get; set; }
    public bool Canceled { get; set; }
    public long CommitStart { get; set; }
    public long CommitEnd { get; set; }
    public long RevealEnd { get; set; }
    public string TotalCommits { get; set; } = "0";
    public string TotalReveals { get; set; } = "0";
    public IReadOnlyList<ElectionV1ResultDto> Results { get; set; } = Array.Empty<ElectionV1ResultDto>();
    public ElectionV1ViewerStateDto? Viewer { get; set; }
}

public sealed class ElectionV1ResultDto
{
    public int CandidateIndex { get; set; }
    public string CandidateId { get; set; } = string.Empty;
    public string CandidateName { get; set; } = string.Empty;
    public string? CandidateSourceId { get; set; }
    public string? CandidateWalletAddress { get; set; }
    public long Count { get; set; }
}

public sealed class ElectionV1ViewerStateDto
{
    public string Address { get; set; } = string.Empty;
    public bool Eligible { get; set; }
    public bool HasCommitted { get; set; }
    public bool HasRevealed { get; set; }
    public string? Commitment { get; set; }
    public bool ProofAvailable { get; set; }
}

public sealed class ElectionV1NormalizedRecord
{
    public string Address { get; set; } = string.Empty;
    public string Admin { get; set; } = string.Empty;
    public int BallotOrder { get; set; }
    public long BlockNumber { get; set; }
    public long CommitStart { get; set; }
    public long CommitEnd { get; set; }
    public long RevealEnd { get; set; }
    public string? CreatedAt { get; set; }
    public string ElectionId { get; set; } = string.Empty;
    public string? ElectionKey { get; set; }
    public string? GroupKey { get; set; }
    public string? GroupTitle { get; set; }
    public string? GroupDescription { get; set; }
    public string? PositionId { get; set; }
    public string? PositionTitle { get; set; }
    public string? PositionDescription { get; set; }
    public ElectionV1Summary? Summary { get; set; }
    public ElectionV1Manifest? Manifest { get; set; }
    public ElectionV1Eligibility? Eligibility { get; set; }
    public string RecordPath { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public int VoterCount { get; set; }
    public IReadOnlyList<ElectionV1CandidateDto> Candidates { get; set; } = Array.Empty<ElectionV1CandidateDto>();
}

public sealed class ElectionV1FactoryRecord
{
    [JsonProperty("address")]
    public string? Address { get; set; }
}

public sealed class ElectionV1DeploymentRecord
{
    [JsonProperty("blockNumber")]
    public long BlockNumber { get; set; }

    [JsonProperty("config")]
    public ElectionV1Config? Config { get; set; }

    [JsonProperty("createdAt")]
    public string? CreatedAt { get; set; }

    [JsonProperty("electionAddress")]
    public string? ElectionAddress { get; set; }

    [JsonProperty("electionId")]
    public string? ElectionId { get; set; }

    [JsonProperty("eligibility")]
    public ElectionV1Eligibility? Eligibility { get; set; }

    [JsonProperty("manifest")]
    public ElectionV1Manifest? Manifest { get; set; }

    [JsonProperty("requesterAddress")]
    public string? RequesterAddress { get; set; }

    [JsonProperty("summary")]
    public ElectionV1Summary? Summary { get; set; }

    [JsonProperty("txHash")]
    public string? TxHash { get; set; }
}

public sealed class ElectionV1Config
{
    [JsonProperty("admin")]
    public string? Admin { get; set; }

    [JsonProperty("commitStart")]
    public long CommitStart { get; set; }

    [JsonProperty("commitEnd")]
    public long CommitEnd { get; set; }

    [JsonProperty("revealEnd")]
    public long RevealEnd { get; set; }

    [JsonProperty("candidateIds")]
    public List<string>? CandidateIds { get; set; }

    [JsonProperty("electionURI")]
    public string? ElectionURI { get; set; }
}

public sealed class ElectionV1Eligibility
{
    [JsonProperty("proofs")]
    public Dictionary<string, List<string>>? Proofs { get; set; }
}

public sealed class ElectionV1Summary
{
    [JsonProperty("voterCount")]
    public int VoterCount { get; set; }
}

public sealed class ElectionV1Manifest
{
    [JsonProperty("title")]
    public string? Title { get; set; }

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("electionKey")]
    public string? ElectionKey { get; set; }

    [JsonProperty("groupKey")]
    public string? GroupKey { get; set; }

    [JsonProperty("groupTitle")]
    public string? GroupTitle { get; set; }

    [JsonProperty("groupDescription")]
    public string? GroupDescription { get; set; }

    [JsonProperty("positionId")]
    public string? PositionId { get; set; }

    [JsonProperty("positionTitle")]
    public string? PositionTitle { get; set; }

    [JsonProperty("positionDescription")]
    public string? PositionDescription { get; set; }

    [JsonProperty("ballotOrder")]
    public int BallotOrder { get; set; }

    [JsonProperty("voterCount")]
    public int VoterCount { get; set; }

    [JsonProperty("candidates")]
    public List<ElectionV1ManifestCandidate>? Candidates { get; set; }
}

public sealed class ElectionV1ManifestCandidate
{
    [JsonProperty("candidateId")]
    public string? CandidateId { get; set; }

    [JsonProperty("id")]
    public string? Id { get; set; }

    [JsonProperty("sourceId")]
    public string? SourceId { get; set; }

    [JsonProperty("name")]
    public string? Name { get; set; }

    [JsonProperty("displayName")]
    public string? DisplayName { get; set; }

    [JsonProperty("walletAddress")]
    public string? WalletAddress { get; set; }
}
