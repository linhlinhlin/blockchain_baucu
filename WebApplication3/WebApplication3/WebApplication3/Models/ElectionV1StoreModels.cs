namespace WebApplication3.Models;

public sealed class ElectionV1RosterDraftRecord
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
    public string PositionsJson { get; set; } = "[]";
    public string? DeploymentJson { get; set; }
    public ICollection<ElectionV1RosterInviteRecord> Invites { get; set; } = new List<ElectionV1RosterInviteRecord>();
}

public sealed class ElectionV1RosterInviteRecord
{
    public int Id { get; set; }
    public string GroupKey { get; set; } = string.Empty;
    public string InviteId { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? StudentCode { get; set; }
    public string InviteUrl { get; set; } = string.Empty;
    public string QrPayload { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastOtpSentAt { get; set; }
    public string? LastOtpCode { get; set; }
    public DateTimeOffset? OtpExpiresAt { get; set; }
    public DateTimeOffset? OtpVerifiedAt { get; set; }
    public int? ClaimedByUserId { get; set; }
    public string? WalletAddress { get; set; }
    public DateTimeOffset? WalletBoundAt { get; set; }
    public ElectionV1RosterDraftRecord? Draft { get; set; }
}
