using System.Diagnostics;
using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Util;
using Newtonsoft.Json;

namespace WebApplication3.Services;

public sealed class ElectionV1CreateService
{
    private readonly ILogger<ElectionV1CreateService> _logger;
    private readonly string _contractsRootPath;
    private readonly string _createElectionScriptPath;
    private readonly string _workingDirectoryPath;
    private readonly string _nodeCommand;
    private readonly bool _developmentAuthEnabled;
    private readonly bool _isDevelopmentEnvironment;

    public ElectionV1CreateService(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<ElectionV1CreateService> logger)
    {
        _logger = logger;
        _contractsRootPath = ElectionV1Workspace.ResolveContractsRootPath(
            configuration["ElectionV1Settings:ContractsRootPath"],
            environment.ContentRootPath);
        _createElectionScriptPath = ElectionV1Workspace.ResolvePathFromContractsRoot(
            _contractsRootPath,
            configuration["ElectionV1Settings:CreateElectionScriptPath"],
            "scripts",
            "createElectionFromInput.js");
        _workingDirectoryPath = ElectionV1Workspace.ResolvePathFromContractsRoot(
            _contractsRootPath,
            configuration["ElectionV1Settings:WorkingInputPath"],
            "tmp",
            "webapplication3");
        _nodeCommand = configuration["ElectionV1Settings:NodeCommand"]
            ?? (OperatingSystem.IsWindows() ? "node.exe" : "node");
        _developmentAuthEnabled = configuration.GetValue<bool>("DevelopmentAuthSettings:Enabled");
        _isDevelopmentEnvironment = environment.IsDevelopment();
    }

    public async Task<ElectionV1CreateResult> CreateElectionAsync(
        ClaimsPrincipal user,
        ElectionV1CreateRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = GetRequiredUserId(user);
        ValidateRequest(request);

        var normalizedAdminWallet = NormalizeAddress(request.AdminWalletAddress);
        if (!UserOwnsWallet(user, normalizedAdminWallet, _isDevelopmentEnvironment && _developmentAuthEnabled))
        {
            throw new InvalidOperationException("Vi admin khong thuoc tai khoan dang dang nhap.");
        }

        return await CreateElectionInternalAsync(
            userId,
            normalizedAdminWallet,
            request,
            DateTimeOffset.UtcNow,
            null,
            cancellationToken);
    }

    public async Task<ElectionV1CreateGroupResult> CreateElectionGroupAsync(
        ClaimsPrincipal user,
        ElectionV1CreateGroupRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = GetRequiredUserId(user);
        ValidateGroupRequest(request);

        var normalizedAdminWallet = NormalizeAddress(request.AdminWalletAddress);
        if (!UserOwnsWallet(user, normalizedAdminWallet, _isDevelopmentEnvironment && _developmentAuthEnabled))
        {
            throw new InvalidOperationException("Vi admin khong thuoc tai khoan dang dang nhap.");
        }

        var timestamp = DateTimeOffset.UtcNow;
        var groupKey = string.IsNullOrWhiteSpace(request.GroupKey)
            ? $"group-{userId}-{CreateSlug(request.Title)}-{timestamp:yyyyMMddHHmmss}"
            : request.GroupKey.Trim();
        var created = new List<ElectionV1CreateResult>();

        for (var index = 0; index < request.Positions.Count; index++)
        {
            var position = request.Positions[index];
            var singleRequest = new ElectionV1CreateRequest
            {
                AdminWalletAddress = normalizedAdminWallet,
                Title = position.Title.Trim(),
                Description = position.Description?.Trim(),
                ElectionKey = $"{groupKey}:position:{index + 1}",
                CommitStart = request.CommitStart,
                CommitEnd = request.CommitEnd,
                RevealEnd = request.RevealEnd,
                Candidates = position.Candidates,
                VoterWalletAddresses = request.VoterWalletAddresses
            };

            var manifestMetadata = new ElectionV1ManifestMetadata
            {
                GroupKey = groupKey,
                GroupTitle = request.Title.Trim(),
                GroupDescription = request.Description?.Trim(),
                PositionId = string.IsNullOrWhiteSpace(position.PositionId)
                    ? $"position:{CreateSlug(position.Title)}:{index + 1}"
                    : position.PositionId.Trim(),
                PositionTitle = position.Title.Trim(),
                PositionDescription = position.Description?.Trim(),
                BallotOrder = index + 1
            };

            var result = await CreateElectionInternalAsync(
                userId,
                normalizedAdminWallet,
                singleRequest,
                timestamp,
                manifestMetadata,
                cancellationToken);
            created.Add(result);
        }

        return new ElectionV1CreateGroupResult
        {
            GroupKey = groupKey,
            Created = created
        };
    }

    private async Task<ElectionV1CreateResult> CreateElectionInternalAsync(
        int userId,
        string normalizedAdminWallet,
        ElectionV1CreateRequest request,
        DateTimeOffset timestamp,
        ElectionV1ManifestMetadata? manifestMetadata,
        CancellationToken cancellationToken)
    {
        ValidateRequest(request);

        var workingDirectory = Path.Combine(
            _workingDirectoryPath,
            $"{timestamp:yyyyMMdd-HHmmss}-{CreateSlug(request.Title)}");
        Directory.CreateDirectory(workingDirectory);

        var inputPayload = BuildInputPayload(userId, normalizedAdminWallet, request, timestamp, manifestMetadata);
        var inputPath = Path.Combine(workingDirectory, "input.json");
        await File.WriteAllTextAsync(
            inputPath,
            JsonConvert.SerializeObject(inputPayload, Formatting.Indented),
            cancellationToken);

        var process = new Process
        {
            StartInfo = BuildProcessStartInfo(inputPath, workingDirectory, userId, normalizedAdminWallet)
        };

        process.Start();
        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        if (process.ExitCode != 0)
        {
            var errorMessage = string.IsNullOrWhiteSpace(stderr) ? stdout : stderr;
            _logger.LogError(
                "Tao election that bai cho user {UserId}. Script: {ScriptPath}. Loi: {Error}",
                userId,
                _createElectionScriptPath,
                errorMessage);
            throw new InvalidOperationException(
                $"Khong the tao election tren Sepolia. {errorMessage.Trim()}");
        }

        var result = ParseCreateResult(stdout);
        if (result is null)
        {
            throw new InvalidOperationException("Khong the doc ket qua deploy election tu helper script.");
        }

        return result;
    }

    private ProcessStartInfo BuildProcessStartInfo(
        string inputPath,
        string workingDirectory,
        int userId,
        string adminWalletAddress)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = _nodeCommand,
            WorkingDirectory = _contractsRootPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add(_createElectionScriptPath);
        startInfo.ArgumentList.Add(inputPath);
        startInfo.ArgumentList.Add(workingDirectory);
        startInfo.Environment["ELECTION_REQUESTER_USER_ID"] = userId.ToString(CultureInfo.InvariantCulture);
        startInfo.Environment["ELECTION_REQUESTER_ADDRESS"] = adminWalletAddress;

        return startInfo;
    }

    private static ElectionV1CreateResult? ParseCreateResult(string stdout)
    {
        var line = stdout
            .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .LastOrDefault(item => item.StartsWith("{", StringComparison.Ordinal));
        if (string.IsNullOrWhiteSpace(line))
        {
            return null;
        }

        var raw = JsonConvert.DeserializeObject<ElectionV1CreateScriptResult>(line);
        if (raw is null)
        {
            return null;
        }

        return new ElectionV1CreateResult
        {
            Address = NormalizeAddress(raw.ElectionAddress ?? string.Empty),
            ElectionId = raw.ElectionId ?? string.Empty,
            LatestPath = raw.LatestPath,
            OutputDirectory = raw.OutputDir,
            SnapshotPath = raw.SnapshotPath,
            TxHash = raw.TxHash ?? string.Empty
        };
    }

    private static object BuildInputPayload(
        int userId,
        string adminWalletAddress,
        ElectionV1CreateRequest request,
        DateTimeOffset timestamp,
        ElectionV1ManifestMetadata? manifestMetadata)
    {
        return new
        {
            admin = adminWalletAddress,
            embedManifestAsDataUri = true,
            manifest = new
            {
                title = request.Title.Trim(),
                description = request.Description?.Trim() ?? string.Empty,
                electionKey = string.IsNullOrWhiteSpace(request.ElectionKey)
                    ? $"webapp3-{userId}-{CreateSlug(request.Title)}-{timestamp:yyyyMMddHHmmss}"
                    : request.ElectionKey.Trim(),
                groupKey = manifestMetadata?.GroupKey,
                groupTitle = manifestMetadata?.GroupTitle,
                groupDescription = manifestMetadata?.GroupDescription,
                positionId = manifestMetadata?.PositionId,
                positionTitle = manifestMetadata?.PositionTitle,
                positionDescription = manifestMetadata?.PositionDescription,
                ballotOrder = manifestMetadata?.BallotOrder ?? 0,
                source = "WebApplication3",
                createdByUserId = userId,
                createdAt = timestamp.ToString("O", CultureInfo.InvariantCulture)
            },
            schedule = new
            {
                commitStart = request.CommitStart.ToString("O", CultureInfo.InvariantCulture),
                commitEnd = request.CommitEnd.ToString("O", CultureInfo.InvariantCulture),
                revealEnd = request.RevealEnd.ToString("O", CultureInfo.InvariantCulture)
            },
            voters = request.VoterWalletAddresses.Select(NormalizeAddress).ToArray(),
            candidates = request.Candidates.Select((candidate, index) => new
            {
                id = string.IsNullOrWhiteSpace(candidate.SourceId)
                    ? $"candidate:{CreateSlug(candidate.DisplayName)}:{index + 1}"
                    : candidate.SourceId.Trim(),
                name = candidate.DisplayName.Trim(),
                walletAddress = string.IsNullOrWhiteSpace(candidate.WalletAddress)
                    ? null
                    : NormalizeAddress(candidate.WalletAddress)
            }).ToArray()
        };
    }

    private static int GetRequiredUserId(ClaimsPrincipal user)
    {
        var claimValue = user.FindFirst("UserID")?.Value;
        if (string.IsNullOrWhiteSpace(claimValue) || !int.TryParse(claimValue, out var userId))
        {
            throw new InvalidOperationException("Khong tim thay UserID hop le trong token.");
        }

        return userId;
    }

    private static void ValidateRequest(ElectionV1CreateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new InvalidOperationException("Tieu de election khong duoc de trong.");
        }

        if (request.CommitStart >= request.CommitEnd || request.CommitEnd >= request.RevealEnd)
        {
            throw new InvalidOperationException("Lich election phai thoa man CommitStart < CommitEnd < RevealEnd.");
        }

        if (request.Candidates is null || request.Candidates.Count < 2)
        {
            throw new InvalidOperationException("Can it nhat 2 ung vien.");
        }

        if (request.VoterWalletAddresses is null || request.VoterWalletAddresses.Count == 0)
        {
            throw new InvalidOperationException("Can it nhat 1 cu tri.");
        }

        var duplicateCandidates = request.Candidates
            .GroupBy(item => item.DisplayName.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicateCandidates is not null)
        {
            throw new InvalidOperationException($"Ten ung vien bi trung: {duplicateCandidates.Key}");
        }

        var duplicateVoters = request.VoterWalletAddresses
            .Select(NormalizeAddress)
            .GroupBy(item => item, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicateVoters is not null)
        {
            throw new InvalidOperationException($"Dia chi cu tri bi trung: {duplicateVoters.Key}");
        }
    }

    private static void ValidateGroupRequest(ElectionV1CreateGroupRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new InvalidOperationException("Tieu de nhom bau cu khong duoc de trong.");
        }

        if (request.Positions is null || request.Positions.Count == 0)
        {
            throw new InvalidOperationException("Can it nhat 1 chuc vu bau cu.");
        }

        var duplicatePositions = request.Positions
            .GroupBy(item => item.Title.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicatePositions is not null)
        {
            throw new InvalidOperationException($"Ten chuc vu bi trung: {duplicatePositions.Key}");
        }

        for (var index = 0; index < request.Positions.Count; index++)
        {
            var position = request.Positions[index];
            if (string.IsNullOrWhiteSpace(position.Title))
            {
                throw new InvalidOperationException($"Chuc vu thu {index + 1} chua co ten.");
            }

            ValidateRequest(new ElectionV1CreateRequest
            {
                AdminWalletAddress = request.AdminWalletAddress,
                Title = position.Title,
                Description = position.Description,
                CommitStart = request.CommitStart,
                CommitEnd = request.CommitEnd,
                RevealEnd = request.RevealEnd,
                Candidates = position.Candidates,
                VoterWalletAddresses = request.VoterWalletAddresses
            });
        }
    }

    private static bool UserOwnsWallet(ClaimsPrincipal user, string walletAddress, bool allowDevelopmentBypass)
    {
        var claimWallets = user
            .FindAll("DiaChiVi")
            .Select(claim => claim.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(NormalizeAddress)
            .ToList();

        if (claimWallets.Count == 0 && allowDevelopmentBypass)
        {
            return true;
        }

        return claimWallets.Any(value => string.Equals(value, walletAddress, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeAddress(string address)
    {
        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(address))
        {
            throw new InvalidOperationException($"Dia chi vi khong hop le: {address}");
        }

        return AddressUtil.Current.ConvertToChecksumAddress(address);
    }

    private static string CreateSlug(string value)
    {
        var trimmed = value.Trim().ToLowerInvariant();
        var slug = Regex.Replace(trimmed, "[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "election" : slug;
    }
}

public sealed class ElectionV1CreateRequest
{
    public string AdminWalletAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ElectionKey { get; set; }
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public List<ElectionV1CreateCandidateRequest> Candidates { get; set; } = new();
    public List<string> VoterWalletAddresses { get; set; } = new();
}

public sealed class ElectionV1CreateCandidateRequest
{
    public string DisplayName { get; set; } = string.Empty;
    public string? SourceId { get; set; }
    public string? WalletAddress { get; set; }
}

public sealed class ElectionV1CreatePositionRequest
{
    public string PositionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<ElectionV1CreateCandidateRequest> Candidates { get; set; } = new();
}

public sealed class ElectionV1CreateGroupRequest
{
    public string AdminWalletAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? GroupKey { get; set; }
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public List<ElectionV1CreatePositionRequest> Positions { get; set; } = new();
    public List<string> VoterWalletAddresses { get; set; } = new();
}

public sealed class ElectionV1CreateResult
{
    public string Address { get; set; } = string.Empty;
    public string ElectionId { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public string? LatestPath { get; set; }
    public string? SnapshotPath { get; set; }
    public string? OutputDirectory { get; set; }
}

public sealed class ElectionV1CreateGroupResult
{
    public string GroupKey { get; set; } = string.Empty;
    public IReadOnlyList<ElectionV1CreateResult> Created { get; set; } = Array.Empty<ElectionV1CreateResult>();
}

public sealed class ElectionV1CreateScriptResult
{
    [JsonProperty("electionAddress")]
    public string? ElectionAddress { get; set; }

    [JsonProperty("electionId")]
    public string? ElectionId { get; set; }

    [JsonProperty("txHash")]
    public string? TxHash { get; set; }

    [JsonProperty("latestPath")]
    public string? LatestPath { get; set; }

    [JsonProperty("snapshotPath")]
    public string? SnapshotPath { get; set; }

    [JsonProperty("outputDir")]
    public string? OutputDir { get; set; }
}

internal sealed class ElectionV1ManifestMetadata
{
    public string? GroupKey { get; set; }
    public string? GroupTitle { get; set; }
    public string? GroupDescription { get; set; }
    public string? PositionId { get; set; }
    public string? PositionTitle { get; set; }
    public string? PositionDescription { get; set; }
    public int BallotOrder { get; set; }
}
