using System.Globalization;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Signer;
using Nethereum.Util;
using Newtonsoft.Json;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Services;

public sealed class ElectionV1RosterService
{
    private readonly ElectionV1CreateService _createService;
    private readonly ElectionV1StoreDbContext _storeDbContext;
    private readonly EmailService _emailService;
    private readonly ILogger<ElectionV1RosterService> _logger;
    private readonly string _appUrl;
    private readonly bool _isDevelopmentEnvironment;
    // S2 (spec 001): chi lo OTP ve client khi co flag dev tuong minh, khong chi dua IsDevelopment.
    private readonly bool _developmentAuthEnabled;
    private const int MaxOtpAttempts = 5;
    private static readonly TimeSpan OtpLockoutWindow = TimeSpan.FromMinutes(15);

    public ElectionV1RosterService(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ElectionV1CreateService createService,
        ElectionV1StoreDbContext storeDbContext,
        EmailService emailService,
        ILogger<ElectionV1RosterService> logger)
    {
        _createService = createService;
        _storeDbContext = storeDbContext;
        _emailService = emailService;
        _logger = logger;
        _isDevelopmentEnvironment = environment.IsDevelopment();
        _developmentAuthEnabled = configuration.GetValue<bool>("DevelopmentAuthSettings:Enabled");
        _appUrl = configuration["AppUrl"]?.TrimEnd('/') ?? "https://127.0.0.1:3000";
    }

    public ElectionV1RosterDraftDto CreateDraft(ClaimsPrincipal user, ElectionV1CreateRosterDraftRequest request)
    {
        var userId = GetRequiredUserId(user);
        ValidateCreateRequest(request);

        var timestamp = DateTimeOffset.UtcNow;
        var groupKey = string.IsNullOrWhiteSpace(request.GroupKey)
            ? $"roster-{userId}-{CreateSlug(request.Title)}-{timestamp:yyyyMMddHHmmss}"
            : request.GroupKey.Trim();
        var normalizedAdminWallet = NormalizeAddress(request.AdminWalletAddress);

        var draft = new ElectionV1RosterDraftDocument
        {
            GroupKey = groupKey,
            CreatedByUserId = userId,
            AdminWalletAddress = normalizedAdminWallet,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            CommitStart = request.CommitStart,
            CommitEnd = request.CommitEnd,
            RevealEnd = request.RevealEnd,
            CreatedAt = timestamp,
            UpdatedAt = timestamp,
            Status = "draft",
            Positions = request.Positions.Select((position, index) => new ElectionV1RosterDraftPosition
            {
                PositionId = string.IsNullOrWhiteSpace(position.PositionId)
                    ? $"position:{CreateSlug(position.Title)}:{index + 1}"
                    : position.PositionId.Trim(),
                Title = position.Title.Trim(),
                Description = position.Description?.Trim(),
                BallotOrder = index + 1,
                Candidates = position.Candidates.Select((candidate, candidateIndex) => new ElectionV1RosterDraftCandidate
                {
                    DisplayName = candidate.DisplayName.Trim(),
                    SourceId = string.IsNullOrWhiteSpace(candidate.SourceId)
                        ? $"candidate:{CreateSlug(candidate.DisplayName)}:{candidateIndex + 1}"
                        : candidate.SourceId.Trim(),
                    WalletAddress = string.IsNullOrWhiteSpace(candidate.WalletAddress)
                        ? null
                        : NormalizeAddress(candidate.WalletAddress)
                }).ToList()
            }).ToList(),
            Invites = request.Voters.Select((voter, index) =>
            {
                var token = GenerateToken();
                var inviteUrl = $"{_appUrl}/verify-voter?token={Uri.EscapeDataString(token)}";
                return new ElectionV1RosterInvite
                {
                    InviteId = $"invite-{index + 1}",
                    Token = token,
                    FullName = voter.FullName.Trim(),
                    Email = voter.Email.Trim(),
                    StudentCode = voter.StudentCode?.Trim(),
                    InviteUrl = inviteUrl,
                    QrPayload = inviteUrl,
                    CreatedAt = timestamp
                };
            }).ToList()
        };

        SaveDraft(draft);
        return ToDraftDto(draft);
    }

    public ElectionV1RosterDraftDto? GetDraft(ClaimsPrincipal user, string groupKey)
    {
        var userId = GetRequiredUserId(user);
        var draft = LoadDraft(groupKey);
        if (draft is null || draft.CreatedByUserId != userId)
        {
            return null;
        }

        return ToDraftDto(draft);
    }

    public ElectionV1RosterPublicInviteDto? ResolveRosterInviteGroup(string groupKey)
    {
        var draft = LoadDraft(groupKey);
        if (draft is null)
        {
            return null;
        }

        return ToPublicInviteDto(draft);
    }

    public ElectionV1RosterInviteResolveDto? ResolveInvite(string token)
    {
        var draft = LoadDraftByToken(token, out var invite);
        if (draft is null || invite is null)
        {
            return null;
        }

        return new ElectionV1RosterInviteResolveDto
        {
            GroupKey = draft.GroupKey,
            BallotTitle = draft.Title,
            BallotDescription = draft.Description,
            InviteId = invite.InviteId,
            FullName = invite.FullName,
            EmailMasked = MaskEmail(invite.Email),
            StudentCode = invite.StudentCode,
            CommitStart = draft.CommitStart,
            CommitEnd = draft.CommitEnd,
            RevealEnd = draft.RevealEnd,
            Positions = draft.Positions
                .OrderBy(item => item.BallotOrder)
                .Select(item => new ElectionV1RosterInvitePositionDto
                {
                    PositionId = item.PositionId,
                    Title = item.Title,
                    Description = item.Description,
                    CandidateNames = item.Candidates.Select(candidate => candidate.DisplayName).ToList()
                })
                .ToList(),
            OtpVerified = invite.OtpVerifiedAt.HasValue,
            WalletBound = !string.IsNullOrWhiteSpace(invite.WalletAddress),
            WalletAddress = invite.WalletAddress,
            Status = draft.Status,
            GroupDeployed = string.Equals(draft.Status, "deployed", StringComparison.OrdinalIgnoreCase),
            InviteUrl = invite.InviteUrl
        };
    }

    public async Task<ElectionV1OtpDispatchDto> SendInviteOtpAsync(string token, CancellationToken cancellationToken = default)
    {
        var draft = LoadDraftByToken(token, out var invite);
        if (draft is null || invite is null)
        {
            throw new InvalidOperationException("Khong tim thay loi moi cu tri.");
        }

        return await DispatchInviteOtpAsync(draft, invite, cancellationToken);
    }

    public async Task<ElectionV1OtpDispatchDto> SendInviteOtpByIdentityAsync(
        string groupKey,
        ElectionV1RosterIdentityOtpRequest request,
        CancellationToken cancellationToken = default)
    {
        var draft = LoadDraft(groupKey);
        if (draft is null)
        {
            throw new InvalidOperationException("Khong tim thay roster draft.");
        }

        var normalizedEmail = NormalizeEmail(request.Email);
        var invite = draft.Invites.FirstOrDefault(item =>
            string.Equals(NormalizeEmail(item.Email), normalizedEmail, StringComparison.OrdinalIgnoreCase));

        if (invite is null || !StudentCodeMatches(invite.StudentCode, request.StudentCode))
        {
            throw new InvalidOperationException("Thong tin cu tri khong khop voi roster.");
        }

        return await DispatchInviteOtpAsync(draft, invite, cancellationToken);
    }

    private async Task<ElectionV1OtpDispatchDto> DispatchInviteOtpAsync(
        ElectionV1RosterDraftDocument draft,
        ElectionV1RosterInvite invite,
        CancellationToken cancellationToken)
    {
        var otp = GenerateOtp();
        // S2: chi luu HASH cua OTP, khong luu plaintext.
        invite.LastOtpCode = BCrypt.Net.BCrypt.HashPassword(otp);
        invite.LastOtpSentAt = DateTimeOffset.UtcNow;
        invite.OtpExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15);
        invite.OtpVerifiedAt = null;
        invite.OtpAttemptCount = 0;
        invite.OtpLockedUntil = null;
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        SaveDraft(draft);

        var subject = $"OTP xac thuc cu tri - {draft.Title}";
        var body = BuildOtpEmailBody(draft, invite, otp);
        string deliveryMode;
        string? devOtpCode = null;

        try
        {
            await _emailService.SendEmailAsync(invite.Email, subject, body, cancellationToken);
            deliveryMode = "email";
        }
        catch (Exception ex)
        {
            if (!_isDevelopmentEnvironment)
            {
                throw new InvalidOperationException("Khong the gui OTP qua email.", ex);
            }

            _logger.LogWarning(ex, "Gui OTP qua email that bai trong moi truong development. Su dung dev preview cho {Email}", invite.Email);
            deliveryMode = "development-preview";
            // S2 (FR-004): chi tra OTP ve client khi DevelopmentAuthSettings:Enabled tuong minh.
            devOtpCode = _developmentAuthEnabled ? otp : null;
        }

        return new ElectionV1OtpDispatchDto
        {
            Message = deliveryMode == "email"
                ? "OTP da duoc gui den email cua cu tri."
                : "SMTP chua san sang. Dev OTP preview duoc tra ve de test luong.",
            DeliveryMode = deliveryMode,
            EmailMasked = MaskEmail(invite.Email),
            ExpiresAt = invite.OtpExpiresAt,
            DevOtpCode = devOtpCode,
            InviteToken = invite.Token,
            InviteId = invite.InviteId
        };
    }

    public ElectionV1OtpVerifyDto VerifyInviteOtp(string token, string otp)
    {
        var draft = LoadDraftByToken(token, out var invite);
        if (draft is null || invite is null)
        {
            throw new InvalidOperationException("Khong tim thay loi moi cu tri.");
        }

        var now = DateTimeOffset.UtcNow;

        // S2 (FR-005): lockout chong brute-force OTP.
        if (invite.OtpLockedUntil.HasValue && invite.OtpLockedUntil.Value > now)
        {
            throw new InvalidOperationException(
                $"Da nhap sai OTP qua nhieu lan. Vui long thu lai sau {Math.Ceiling((invite.OtpLockedUntil.Value - now).TotalMinutes)} phut.");
        }

        if (string.IsNullOrWhiteSpace(invite.LastOtpCode) || !invite.OtpExpiresAt.HasValue)
        {
            throw new InvalidOperationException("OTP chua duoc gui hoac da het hieu luc.");
        }

        if (invite.OtpExpiresAt.Value < now)
        {
            throw new InvalidOperationException("OTP da het han.");
        }

        // S2 (FR-003): so khop bang hash, khong so plaintext.
        bool otpMatches;
        try
        {
            otpMatches = BCrypt.Net.BCrypt.Verify(otp?.Trim() ?? string.Empty, invite.LastOtpCode);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // Hash khong hop le (vd du lieu OTP cu plaintext) -> coi nhu sai.
            otpMatches = false;
        }

        if (!otpMatches)
        {
            invite.OtpAttemptCount += 1;
            if (invite.OtpAttemptCount >= MaxOtpAttempts)
            {
                invite.OtpLockedUntil = now.Add(OtpLockoutWindow);
                invite.LastOtpCode = null;
                invite.OtpExpiresAt = null;
                invite.OtpAttemptCount = 0;
                draft.UpdatedAt = now;
                SaveDraft(draft);
                throw new InvalidOperationException(
                    $"Da nhap sai OTP qua nhieu lan. Loi moi bi tam khoa {OtpLockoutWindow.TotalMinutes:0} phut.");
            }

            draft.UpdatedAt = now;
            SaveDraft(draft);
            throw new InvalidOperationException(
                $"OTP khong hop le. Con {MaxOtpAttempts - invite.OtpAttemptCount} lan thu.");
        }

        invite.LastOtpCode = null;
        invite.OtpVerifiedAt = now;
        invite.OtpExpiresAt = null;
        invite.OtpAttemptCount = 0;
        invite.OtpLockedUntil = null;
        draft.UpdatedAt = now;
        SaveDraft(draft);

        return new ElectionV1OtpVerifyDto
        {
            Message = "OTP hop le. Ban co the lien ket MetaMask de duoc dua vao danh sach cu tri.",
            OtpVerified = true
        };
    }

    public ElectionV1WalletBindingChallengeDto PrepareWalletBinding(ClaimsPrincipal user, string token, string walletAddress)
    {
        var userId = GetRequiredUserId(user);
        var draft = LoadDraftByToken(token, out var invite);
        if (draft is null || invite is null)
        {
            throw new InvalidOperationException("Khong tim thay loi moi cu tri.");
        }

        if (!invite.OtpVerifiedAt.HasValue)
        {
            throw new InvalidOperationException("Can xac thuc OTP truoc khi lien ket vi.");
        }

        // S13 (spec 002): gan invite voi tai khoan dau tien; tai khoan khac khong the chiem slot.
        if (invite.ClaimedByUserId.HasValue && invite.ClaimedByUserId.Value != userId)
        {
            throw new InvalidOperationException("Loi moi nay da duoc lien ket voi tai khoan khac.");
        }
        if (!invite.ClaimedByUserId.HasValue)
        {
            invite.ClaimedByUserId = userId;
            draft.UpdatedAt = DateTimeOffset.UtcNow;
            SaveDraft(draft);
        }

        var normalizedWallet = NormalizeAddress(walletAddress);
        var message = BuildWalletBindingMessage(draft, invite, normalizedWallet, userId);
        return new ElectionV1WalletBindingChallengeDto
        {
            WalletAddress = normalizedWallet,
            Message = message
        };
    }

    public ElectionV1RosterInviteBindDto BindWallet(ClaimsPrincipal user, string token, ElectionV1BindWalletRequest request)
    {
        var userId = GetRequiredUserId(user);
        var draft = LoadDraftByToken(token, out var invite);
        if (draft is null || invite is null)
        {
            throw new InvalidOperationException("Khong tim thay loi moi cu tri.");
        }

        if (!invite.OtpVerifiedAt.HasValue)
        {
            throw new InvalidOperationException("Can xac thuc OTP truoc khi lien ket vi.");
        }

        // S13 (spec 002): chi tai khoan da claim invite moi duoc bind.
        if (invite.ClaimedByUserId.HasValue && invite.ClaimedByUserId.Value != userId)
        {
            throw new InvalidOperationException("Loi moi nay da duoc lien ket voi tai khoan khac.");
        }

        if (string.Equals(draft.Status, "deployed", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Ballot da duoc deploy. Khong the bind them vi.");
        }

        var normalizedWallet = NormalizeAddress(request.WalletAddress);
        var duplicateInvite = draft.Invites.FirstOrDefault(item =>
            !string.Equals(item.InviteId, invite.InviteId, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(item.WalletAddress)
            && string.Equals(item.WalletAddress, normalizedWallet, StringComparison.OrdinalIgnoreCase));
        if (duplicateInvite is not null)
        {
            throw new InvalidOperationException("Vi nay da duoc su dung cho mot cu tri khac trong ballot.");
        }

        var message = BuildWalletBindingMessage(draft, invite, normalizedWallet, userId);
        var signer = new EthereumMessageSigner();
        string recovered;
        try
        {
            recovered = signer.EncodeUTF8AndEcRecover(message, request.Signature);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Chu ky MetaMask khong hop le.", ex);
        }

        if (!string.Equals(NormalizeAddress(recovered), normalizedWallet, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Chu ky MetaMask khong khop voi dia chi vi.");
        }

        invite.ClaimedByUserId = userId;
        invite.WalletAddress = normalizedWallet;
        invite.WalletBoundAt = DateTimeOffset.UtcNow;
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        SaveDraft(draft);

        return new ElectionV1RosterInviteBindDto
        {
            Message = "Lien ket vi thanh cong. Cu tri da duoc dua vao danh sach xac thuc.",
            GroupKey = draft.GroupKey,
            InviteId = invite.InviteId,
            WalletAddress = normalizedWallet,
            ClaimedByUserId = userId
        };
    }

    public async Task<ElectionV1RosterDeployResponseDto> DeployDraftAsync(
        ClaimsPrincipal user,
        string groupKey,
        CancellationToken cancellationToken = default)
    {
        var userId = GetRequiredUserId(user);
        var draft = LoadDraft(groupKey);
        if (draft is null || draft.CreatedByUserId != userId)
        {
            throw new InvalidOperationException("Khong tim thay roster draft hoac ban khong co quyen deploy.");
        }

        if (string.Equals(draft.Status, "deployed", StringComparison.OrdinalIgnoreCase) && draft.Deployment is not null)
        {
            return new ElectionV1RosterDeployResponseDto
            {
                Message = "Roster nay da duoc deploy truoc do.",
                GroupKey = draft.GroupKey,
                IncludedVoterCount = draft.Deployment.IncludedVoterCount,
                Created = draft.Deployment.Created
                    .Select(item => new ElectionV1CreateResult
                    {
                        Address = item.Address,
                        ElectionId = item.ElectionId,
                        TxHash = item.TxHash,
                        LatestPath = item.LatestPath,
                        SnapshotPath = item.SnapshotPath,
                        OutputDirectory = item.OutputDirectory
                    })
                    .ToList()
            };
        }

        var verifiedWallets = draft.Invites
            .Where(item => item.OtpVerifiedAt.HasValue && !string.IsNullOrWhiteSpace(item.WalletAddress))
            .Select(item => NormalizeAddress(item.WalletAddress!))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (verifiedWallets.Count == 0)
        {
            throw new InvalidOperationException("Chua co cu tri nao xac thuc OTP va lien ket vi.");
        }

        var createRequest = new ElectionV1CreateGroupRequest
        {
            AdminWalletAddress = draft.AdminWalletAddress,
            Title = draft.Title,
            Description = draft.Description,
            GroupKey = draft.GroupKey,
            CommitStart = draft.CommitStart,
            CommitEnd = draft.CommitEnd,
            RevealEnd = draft.RevealEnd,
            VoterWalletAddresses = verifiedWallets,
            Positions = draft.Positions
                .OrderBy(item => item.BallotOrder)
                .Select(item => new ElectionV1CreatePositionRequest
                {
                    PositionId = item.PositionId,
                    Title = item.Title,
                    Description = item.Description,
                    Candidates = item.Candidates.Select(candidate => new ElectionV1CreateCandidateRequest
                    {
                        DisplayName = candidate.DisplayName,
                        SourceId = candidate.SourceId,
                        WalletAddress = candidate.WalletAddress
                    }).ToList()
                })
                .ToList()
        };

        var created = await _createService.CreateElectionGroupAsync(user, createRequest, cancellationToken);
        draft.Status = "deployed";
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        draft.Deployment = new ElectionV1RosterDeploymentRecord
        {
            DeployedAt = DateTimeOffset.UtcNow,
            IncludedVoterCount = verifiedWallets.Count,
            GroupKey = created.GroupKey,
            Created = created.Created.Select(item => new ElectionV1RosterCreateResultRecord
            {
                Address = item.Address,
                ElectionId = item.ElectionId,
                TxHash = item.TxHash,
                LatestPath = item.LatestPath,
                SnapshotPath = item.SnapshotPath,
                OutputDirectory = item.OutputDirectory
            }).ToList()
        };
        SaveDraft(draft);

        return new ElectionV1RosterDeployResponseDto
        {
            Message = "Da deploy ElectionV1 tu roster draft.",
            GroupKey = draft.GroupKey,
            IncludedVoterCount = verifiedWallets.Count,
            Created = created.Created.ToList()
        };
    }

    private void ValidateCreateRequest(ElectionV1CreateRosterDraftRequest request)
    {
        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(request.AdminWalletAddress))
        {
            throw new InvalidOperationException("Dia chi vi admin khong hop le.");
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new InvalidOperationException("Tieu de ballot khong duoc de trong.");
        }

        if (request.CommitStart >= request.CommitEnd || request.CommitEnd >= request.RevealEnd)
        {
            throw new InvalidOperationException("Lich ballot phai thoa man CommitStart < CommitEnd < RevealEnd.");
        }

        if (request.Positions is null || request.Positions.Count == 0)
        {
            throw new InvalidOperationException("Can it nhat 1 chuc vu.");
        }

        if (request.Voters is null || request.Voters.Count == 0)
        {
            throw new InvalidOperationException("Can it nhat 1 cu tri.");
        }

        var duplicateEmails = request.Voters
            .GroupBy(item => item.Email.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicateEmails is not null)
        {
            throw new InvalidOperationException($"Email cu tri bi trung: {duplicateEmails.Key}");
        }

        foreach (var voter in request.Voters)
        {
            if (string.IsNullOrWhiteSpace(voter.FullName))
            {
                throw new InvalidOperationException("Moi cu tri phai co ho ten.");
            }

            _ = new MailAddress(voter.Email);
        }

        var duplicatePositions = request.Positions
            .GroupBy(item => item.Title.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicatePositions is not null)
        {
            throw new InvalidOperationException($"Ten chuc vu bi trung: {duplicatePositions.Key}");
        }

        foreach (var position in request.Positions)
        {
            if (string.IsNullOrWhiteSpace(position.Title))
            {
                throw new InvalidOperationException("Moi chuc vu phai co ten.");
            }

            if (position.Candidates is null || position.Candidates.Count < 2)
            {
                throw new InvalidOperationException($"Chuc vu {position.Title} can it nhat 2 ung vien.");
            }
        }
    }

    private ElectionV1RosterDraftDocument? LoadDraft(string groupKey)
    {
        var record = _storeDbContext.ElectionV1RosterDrafts
            .AsNoTracking()
            .Include(item => item.Invites)
            .FirstOrDefault(item => item.GroupKey == groupKey);

        return record is null ? null : ToDraftDocument(record);
    }

    private ElectionV1RosterDraftDocument? LoadDraftByToken(string token, out ElectionV1RosterInvite? invite)
    {
        invite = null;
        var inviteRecord = _storeDbContext.ElectionV1RosterInvites
            .AsNoTracking()
            .FirstOrDefault(item => item.Token == token);
        if (inviteRecord is null)
        {
            return null;
        }

        var draft = LoadDraft(inviteRecord.GroupKey);
        if (draft is null)
        {
            return null;
        }

        invite = draft.Invites.FirstOrDefault(item => string.Equals(item.InviteId, inviteRecord.InviteId, StringComparison.OrdinalIgnoreCase));
        return invite is null ? null : draft;
    }

    private void SaveDraft(ElectionV1RosterDraftDocument draft)
    {
        draft.UpdatedAt = DateTimeOffset.UtcNow;
        var record = _storeDbContext.ElectionV1RosterDrafts
            .Include(item => item.Invites)
            .FirstOrDefault(item => item.GroupKey == draft.GroupKey);

        if (record is null)
        {
            record = new ElectionV1RosterDraftRecord
            {
                GroupKey = draft.GroupKey,
                CreatedAt = draft.CreatedAt
            };
            _storeDbContext.ElectionV1RosterDrafts.Add(record);
        }

        record.CreatedByUserId = draft.CreatedByUserId;
        record.AdminWalletAddress = draft.AdminWalletAddress;
        record.Title = draft.Title;
        record.Description = draft.Description;
        record.CommitStart = draft.CommitStart;
        record.CommitEnd = draft.CommitEnd;
        record.RevealEnd = draft.RevealEnd;
        record.Status = draft.Status;
        record.CreatedAt = draft.CreatedAt;
        record.UpdatedAt = draft.UpdatedAt;
        record.PositionsJson = JsonConvert.SerializeObject(draft.Positions, Formatting.None);
        record.DeploymentJson = draft.Deployment is null
            ? null
            : JsonConvert.SerializeObject(draft.Deployment, Formatting.None);

        var existingInvites = record.Invites.ToDictionary(item => item.InviteId, StringComparer.OrdinalIgnoreCase);
        foreach (var invite in draft.Invites)
        {
            if (!existingInvites.TryGetValue(invite.InviteId, out var inviteRecord))
            {
                inviteRecord = new ElectionV1RosterInviteRecord
                {
                    GroupKey = draft.GroupKey,
                    InviteId = invite.InviteId
                };
                record.Invites.Add(inviteRecord);
            }

            inviteRecord.GroupKey = draft.GroupKey;
            inviteRecord.InviteId = invite.InviteId;
            inviteRecord.Token = invite.Token;
            inviteRecord.FullName = invite.FullName;
            inviteRecord.Email = invite.Email;
            inviteRecord.StudentCode = invite.StudentCode;
            inviteRecord.InviteUrl = invite.InviteUrl;
            inviteRecord.QrPayload = invite.QrPayload;
            inviteRecord.CreatedAt = invite.CreatedAt;
            inviteRecord.LastOtpSentAt = invite.LastOtpSentAt;
            inviteRecord.LastOtpCode = invite.LastOtpCode;
            inviteRecord.OtpExpiresAt = invite.OtpExpiresAt;
            inviteRecord.OtpVerifiedAt = invite.OtpVerifiedAt;
            inviteRecord.OtpAttemptCount = invite.OtpAttemptCount;
            inviteRecord.OtpLockedUntil = invite.OtpLockedUntil;
            inviteRecord.ClaimedByUserId = invite.ClaimedByUserId;
            inviteRecord.WalletAddress = invite.WalletAddress;
            inviteRecord.WalletBoundAt = invite.WalletBoundAt;
        }

        var inviteIds = draft.Invites
            .Select(item => item.InviteId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var staleInvites = record.Invites
            .Where(item => !inviteIds.Contains(item.InviteId))
            .ToList();
        if (staleInvites.Count > 0)
        {
            _storeDbContext.ElectionV1RosterInvites.RemoveRange(staleInvites);
        }

        _storeDbContext.SaveChanges();
    }

    private ElectionV1RosterDraftDocument ToDraftDocument(ElectionV1RosterDraftRecord record)
    {
        var positions = string.IsNullOrWhiteSpace(record.PositionsJson)
            ? new List<ElectionV1RosterDraftPosition>()
            : JsonConvert.DeserializeObject<List<ElectionV1RosterDraftPosition>>(record.PositionsJson) ?? new List<ElectionV1RosterDraftPosition>();
        var deployment = string.IsNullOrWhiteSpace(record.DeploymentJson)
            ? null
            : JsonConvert.DeserializeObject<ElectionV1RosterDeploymentRecord>(record.DeploymentJson);

        return new ElectionV1RosterDraftDocument
        {
            GroupKey = record.GroupKey,
            CreatedByUserId = record.CreatedByUserId,
            AdminWalletAddress = record.AdminWalletAddress,
            Title = record.Title,
            Description = record.Description,
            CommitStart = record.CommitStart,
            CommitEnd = record.CommitEnd,
            RevealEnd = record.RevealEnd,
            Status = record.Status,
            CreatedAt = record.CreatedAt,
            UpdatedAt = record.UpdatedAt,
            Positions = positions,
            Deployment = deployment,
            Invites = record.Invites
                .OrderBy(item => item.CreatedAt)
                .ThenBy(item => item.InviteId, StringComparer.OrdinalIgnoreCase)
                .Select(item => new ElectionV1RosterInvite
                {
                    InviteId = item.InviteId,
                    Token = item.Token,
                    FullName = item.FullName,
                    Email = item.Email,
                    StudentCode = item.StudentCode,
                    InviteUrl = item.InviteUrl,
                    QrPayload = item.QrPayload,
                    CreatedAt = item.CreatedAt,
                    LastOtpSentAt = item.LastOtpSentAt,
                    LastOtpCode = item.LastOtpCode,
                    OtpExpiresAt = item.OtpExpiresAt,
                    OtpVerifiedAt = item.OtpVerifiedAt,
                    OtpAttemptCount = item.OtpAttemptCount,
                    OtpLockedUntil = item.OtpLockedUntil,
                    ClaimedByUserId = item.ClaimedByUserId,
                    WalletAddress = item.WalletAddress,
                    WalletBoundAt = item.WalletBoundAt
                })
                .ToList()
        };
    }

    private ElectionV1RosterDraftDto ToDraftDto(ElectionV1RosterDraftDocument draft)
    {
        return new ElectionV1RosterDraftDto
        {
            GroupKey = draft.GroupKey,
            SharedInviteUrl = BuildSharedInviteUrl(draft.GroupKey),
            Title = draft.Title,
            Description = draft.Description,
            AdminWalletAddress = draft.AdminWalletAddress,
            CommitStart = draft.CommitStart,
            CommitEnd = draft.CommitEnd,
            RevealEnd = draft.RevealEnd,
            Status = draft.Status,
            CreatedAt = draft.CreatedAt,
            UpdatedAt = draft.UpdatedAt,
            TotalInviteCount = draft.Invites.Count,
            OtpVerifiedCount = draft.Invites.Count(item => item.OtpVerifiedAt.HasValue),
            WalletBoundCount = draft.Invites.Count(item => !string.IsNullOrWhiteSpace(item.WalletAddress)),
            IncludedVoterCount = draft.Deployment?.IncludedVoterCount ?? 0,
            Positions = draft.Positions
                .OrderBy(item => item.BallotOrder)
                .Select(item => new ElectionV1RosterDraftPositionDto
                {
                    PositionId = item.PositionId,
                    Title = item.Title,
                    Description = item.Description,
                    BallotOrder = item.BallotOrder,
                    Candidates = item.Candidates.Select(candidate => new ElectionV1CandidateDto
                    {
                        CandidateId = candidate.SourceId,
                        DisplayName = candidate.DisplayName,
                        SourceId = candidate.SourceId,
                        WalletAddress = candidate.WalletAddress
                    }).ToList()
                })
                .ToList(),
            Invites = draft.Invites.Select(item => new ElectionV1RosterInviteDto
            {
                InviteId = item.InviteId,
                FullName = item.FullName,
                Email = item.Email,
                StudentCode = item.StudentCode,
                InviteUrl = item.InviteUrl,
                QrPayload = item.QrPayload,
                OtpVerified = item.OtpVerifiedAt.HasValue,
                WalletAddress = item.WalletAddress,
                ClaimedByUserId = item.ClaimedByUserId,
                WalletBoundAt = item.WalletBoundAt
            }).ToList(),
            Deployment = draft.Deployment is null
                ? null
                : new ElectionV1RosterDeploymentDto
                {
                    DeployedAt = draft.Deployment.DeployedAt,
                    IncludedVoterCount = draft.Deployment.IncludedVoterCount,
                    GroupKey = draft.Deployment.GroupKey,
                    Created = draft.Deployment.Created.Select(item => new ElectionV1CreateResult
                    {
                        Address = item.Address,
                        ElectionId = item.ElectionId,
                        TxHash = item.TxHash,
                        LatestPath = item.LatestPath,
                        SnapshotPath = item.SnapshotPath,
                        OutputDirectory = item.OutputDirectory
                    }).ToList()
                }
        };
    }

    private ElectionV1RosterPublicInviteDto ToPublicInviteDto(ElectionV1RosterDraftDocument draft)
    {
        return new ElectionV1RosterPublicInviteDto
        {
            GroupKey = draft.GroupKey,
            BallotTitle = draft.Title,
            BallotDescription = draft.Description,
            CommitStart = draft.CommitStart,
            CommitEnd = draft.CommitEnd,
            RevealEnd = draft.RevealEnd,
            Status = draft.Status,
            GroupDeployed = string.Equals(draft.Status, "deployed", StringComparison.OrdinalIgnoreCase),
            SharedInviteUrl = BuildSharedInviteUrl(draft.GroupKey),
            TotalInviteCount = draft.Invites.Count,
            OtpVerifiedCount = draft.Invites.Count(item => item.OtpVerifiedAt.HasValue),
            WalletBoundCount = draft.Invites.Count(item => !string.IsNullOrWhiteSpace(item.WalletAddress)),
            Positions = draft.Positions
                .OrderBy(item => item.BallotOrder)
                .Select(item => new ElectionV1RosterInvitePositionDto
                {
                    PositionId = item.PositionId,
                    Title = item.Title,
                    Description = item.Description,
                    CandidateNames = item.Candidates.Select(candidate => candidate.DisplayName).ToList()
                })
                .ToList()
        };
    }

    private string BuildSharedInviteUrl(string groupKey)
    {
        return $"{_appUrl}/verify-voter?groupKey={Uri.EscapeDataString(groupKey)}";
    }

    private static string NormalizeEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidOperationException("Email cu tri khong hop le.");
        }

        return new MailAddress(email.Trim()).Address.ToLowerInvariant();
    }

    private static bool StudentCodeMatches(string? inviteStudentCode, string? requestedStudentCode)
    {
        // S7 (spec 002): roster khong luu ma SV -> dinh danh bang email (khong noi long them).
        if (string.IsNullOrWhiteSpace(inviteStudentCode))
        {
            return true;
        }

        // Roster CO ma SV -> bat buoc request phai co va khop chinh xac (khong coi trong la khop).
        if (string.IsNullOrWhiteSpace(requestedStudentCode))
        {
            return false;
        }

        return string.Equals(
            inviteStudentCode.Trim(),
            requestedStudentCode.Trim(),
            StringComparison.OrdinalIgnoreCase);
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

    private static string GenerateToken()
    {
        Span<byte> buffer = stackalloc byte[32];
        RandomNumberGenerator.Fill(buffer);
        return Convert.ToBase64String(buffer)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", string.Empty);
    }

    private static string GenerateOtp()
    {
        return RandomNumberGenerator.GetInt32(100000, 999999).ToString(CultureInfo.InvariantCulture);
    }

    private static string NormalizeAddress(string address)
    {
        if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(address))
        {
            throw new InvalidOperationException($"Dia chi vi khong hop le: {address}");
        }

        return AddressUtil.Current.ConvertToChecksumAddress(address);
    }

    private static string BuildWalletBindingMessage(ElectionV1RosterDraftDocument draft, ElectionV1RosterInvite invite, string walletAddress, int userId)
    {
        return string.Join(
            "\n",
            "HoLiHu ElectionV1 wallet binding",
            $"GroupKey: {draft.GroupKey}",
            $"Ballot: {draft.Title}",
            $"InviteId: {invite.InviteId}",
            $"Email: {invite.Email}",
            $"UserID: {userId}",
            $"Wallet: {walletAddress}");
    }

    private static string CreateSlug(string value)
    {
        var chars = value
            .Trim()
            .ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .ToArray();
        var slug = new string(chars);
        while (slug.Contains("--", StringComparison.Ordinal))
        {
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        }

        return slug.Trim('-');
    }

    private static string MaskEmail(string email)
    {
        try
        {
            var address = new MailAddress(email);
            var local = address.User;
            var maskedLocal = local.Length switch
            {
                <= 1 => "*",
                2 => $"{local[0]}*",
                _ => $"{local[0]}{local[1]}***"
            };
            var domainParts = address.Host.Split('.', StringSplitOptions.RemoveEmptyEntries);
            if (domainParts.Length == 0)
            {
                return $"{maskedLocal}@***";
            }

            var firstDomain = domainParts[0];
            var maskedDomain = firstDomain.Length == 1 ? "*" : $"{firstDomain[0]}***";
            var suffix = domainParts.Length > 1 ? $".{string.Join(".", domainParts.Skip(1))}" : string.Empty;
            return $"{maskedLocal}@{maskedDomain}{suffix}";
        }
        catch
        {
            return email;
        }
    }

    private static string BuildOtpEmailBody(ElectionV1RosterDraftDocument draft, ElectionV1RosterInvite invite, string otp)
    {
        return $"""
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>OTP xac thuc cu tri</h2>
          <p>Xin chao {System.Net.WebUtility.HtmlEncode(invite.FullName)},</p>
          <p>Ban dang xac thuc de tham gia ballot <strong>{System.Net.WebUtility.HtmlEncode(draft.Title)}</strong>.</p>
          <p>Ma OTP cua ban la:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:12px 16px;border:1px solid #d1d5db;border-radius:12px;display:inline-block;background:#f9fafb">{otp}</div>
          <p>OTP co hieu luc trong 15 phut.</p>
          <p>Neu ban khong thuc hien yeu cau nay, hay bo qua email.</p>
        </div>
        """;
    }
}

public sealed class ElectionV1CreateRosterDraftRequest
{
    public string AdminWalletAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? GroupKey { get; set; }
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public List<ElectionV1CreatePositionRequest> Positions { get; set; } = new();
    public List<ElectionV1RosterVoterInput> Voters { get; set; } = new();
}

public sealed class ElectionV1RosterVoterInput
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? StudentCode { get; set; }
}

public sealed class ElectionV1RosterDraftDto
{
    public string GroupKey { get; set; } = string.Empty;
    public string SharedInviteUrl { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string AdminWalletAddress { get; set; } = string.Empty;
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public string Status { get; set; } = "draft";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public int TotalInviteCount { get; set; }
    public int OtpVerifiedCount { get; set; }
    public int WalletBoundCount { get; set; }
    public int IncludedVoterCount { get; set; }
    public List<ElectionV1RosterDraftPositionDto> Positions { get; set; } = new();
    public List<ElectionV1RosterInviteDto> Invites { get; set; } = new();
    public ElectionV1RosterDeploymentDto? Deployment { get; set; }
}

public sealed class ElectionV1RosterPublicInviteDto
{
    public string GroupKey { get; set; } = string.Empty;
    public string BallotTitle { get; set; } = string.Empty;
    public string? BallotDescription { get; set; }
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public List<ElectionV1RosterInvitePositionDto> Positions { get; set; } = new();
    public string Status { get; set; } = "draft";
    public bool GroupDeployed { get; set; }
    public string SharedInviteUrl { get; set; } = string.Empty;
    public int TotalInviteCount { get; set; }
    public int OtpVerifiedCount { get; set; }
    public int WalletBoundCount { get; set; }
}

public sealed class ElectionV1RosterDraftPositionDto
{
    public string PositionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int BallotOrder { get; set; }
    public List<ElectionV1CandidateDto> Candidates { get; set; } = new();
}

public sealed class ElectionV1RosterInviteDto
{
    public string InviteId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? StudentCode { get; set; }
    public string InviteUrl { get; set; } = string.Empty;
    public string QrPayload { get; set; } = string.Empty;
    public bool OtpVerified { get; set; }
    public string? WalletAddress { get; set; }
    public int? ClaimedByUserId { get; set; }
    public DateTimeOffset? WalletBoundAt { get; set; }
}

public sealed class ElectionV1RosterDeploymentDto
{
    public DateTimeOffset DeployedAt { get; set; }
    public int IncludedVoterCount { get; set; }
    public string GroupKey { get; set; } = string.Empty;
    public List<ElectionV1CreateResult> Created { get; set; } = new();
}

public sealed class ElectionV1RosterInviteResolveDto
{
    public string GroupKey { get; set; } = string.Empty;
    public string BallotTitle { get; set; } = string.Empty;
    public string? BallotDescription { get; set; }
    public string InviteId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string EmailMasked { get; set; } = string.Empty;
    public string? StudentCode { get; set; }
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public List<ElectionV1RosterInvitePositionDto> Positions { get; set; } = new();
    public bool OtpVerified { get; set; }
    public bool WalletBound { get; set; }
    public string? WalletAddress { get; set; }
    public string Status { get; set; } = "draft";
    public bool GroupDeployed { get; set; }
    public string InviteUrl { get; set; } = string.Empty;
}

public sealed class ElectionV1RosterInvitePositionDto
{
    public string PositionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> CandidateNames { get; set; } = new();
}

public sealed class ElectionV1OtpDispatchDto
{
    public string Message { get; set; } = string.Empty;
    public string DeliveryMode { get; set; } = "email";
    public string EmailMasked { get; set; } = string.Empty;
    public DateTimeOffset? ExpiresAt { get; set; }
    public string? DevOtpCode { get; set; }
    public string? InviteToken { get; set; }
    public string? InviteId { get; set; }
}

public sealed class ElectionV1OtpVerifyDto
{
    public string Message { get; set; } = string.Empty;
    public bool OtpVerified { get; set; }
}

public sealed class ElectionV1WalletBindingChallengeDto
{
    public string WalletAddress { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public sealed class ElectionV1BindWalletRequest
{
    public string WalletAddress { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
}

public sealed class ElectionV1PrepareWalletBindingRequest
{
    public string WalletAddress { get; set; } = string.Empty;
}

public sealed class ElectionV1OtpVerifyRequest
{
    public string Otp { get; set; } = string.Empty;
}

public sealed class ElectionV1RosterIdentityOtpRequest
{
    public string Email { get; set; } = string.Empty;
    public string? StudentCode { get; set; }
}

public sealed class ElectionV1RosterInviteBindDto
{
    public string Message { get; set; } = string.Empty;
    public string GroupKey { get; set; } = string.Empty;
    public string InviteId { get; set; } = string.Empty;
    public string WalletAddress { get; set; } = string.Empty;
    public int ClaimedByUserId { get; set; }
}

public sealed class ElectionV1RosterDeployResponseDto
{
    public string Message { get; set; } = string.Empty;
    public string GroupKey { get; set; } = string.Empty;
    public int IncludedVoterCount { get; set; }
    public List<ElectionV1CreateResult> Created { get; set; } = new();
}

internal sealed class ElectionV1RosterDraftDocument
{
    public string GroupKey { get; set; } = string.Empty;
    public int CreatedByUserId { get; set; }
    public string AdminWalletAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTimeOffset CommitStart { get; set; }
    public DateTimeOffset CommitEnd { get; set; }
    public DateTimeOffset RevealEnd { get; set; }
    public string Status { get; set; } = "draft";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public List<ElectionV1RosterDraftPosition> Positions { get; set; } = new();
    public List<ElectionV1RosterInvite> Invites { get; set; } = new();
    public ElectionV1RosterDeploymentRecord? Deployment { get; set; }
}

internal sealed class ElectionV1RosterDraftPosition
{
    public string PositionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int BallotOrder { get; set; }
    public List<ElectionV1RosterDraftCandidate> Candidates { get; set; } = new();
}

internal sealed class ElectionV1RosterDraftCandidate
{
    public string DisplayName { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string? WalletAddress { get; set; }
}

internal sealed class ElectionV1RosterInvite
{
    public string InviteId { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? StudentCode { get; set; }
    public string InviteUrl { get; set; } = string.Empty;
    public string QrPayload { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastOtpSentAt { get; set; }
    // S2 (spec 001): HASH cua OTP (BCrypt), khong phai plaintext.
    public string? LastOtpCode { get; set; }
    public DateTimeOffset? OtpExpiresAt { get; set; }
    public DateTimeOffset? OtpVerifiedAt { get; set; }
    public int OtpAttemptCount { get; set; }
    public DateTimeOffset? OtpLockedUntil { get; set; }
    public int? ClaimedByUserId { get; set; }
    public string? WalletAddress { get; set; }
    public DateTimeOffset? WalletBoundAt { get; set; }
}

internal sealed class ElectionV1RosterDeploymentRecord
{
    public DateTimeOffset DeployedAt { get; set; }
    public int IncludedVoterCount { get; set; }
    public string GroupKey { get; set; } = string.Empty;
    public List<ElectionV1RosterCreateResultRecord> Created { get; set; } = new();
}

internal sealed class ElectionV1RosterCreateResultRecord
{
    public string Address { get; set; } = string.Empty;
    public string ElectionId { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public string? LatestPath { get; set; }
    public string? SnapshotPath { get; set; }
    public string? OutputDirectory { get; set; }
}
