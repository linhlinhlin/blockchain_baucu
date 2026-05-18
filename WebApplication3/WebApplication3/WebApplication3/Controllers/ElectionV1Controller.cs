using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nethereum.Util;
using WebApplication3.Services;

namespace WebApplication3.Controllers;

[ApiController]
[Route("api/election-v1")]
public sealed class ElectionV1Controller : ControllerBase
{
    private readonly ElectionV1ReadService _electionService;
    private readonly ElectionV1CreateService _createService;
    private readonly ElectionV1RosterService _rosterService;

    public ElectionV1Controller(
        ElectionV1ReadService electionService,
        ElectionV1CreateService createService,
        ElectionV1RosterService rosterService)
    {
        _electionService = electionService;
        _createService = createService;
        _rosterService = rosterService;
    }

    [HttpGet("public-config")]
    public IActionResult GetPublicConfig()
    {
        return Ok(_electionService.GetPublicConfig());
    }

    [HttpGet("elections")]
    public IActionResult ListElections()
    {
        return Ok(new ElectionV1ListResponseDto
        {
            Items = _electionService.ListElections()
        });
    }

    [HttpGet("election-groups")]
    public IActionResult ListElectionGroups()
    {
        return Ok(new ElectionV1GroupListResponseDto
        {
            Items = _electionService.ListElectionGroups()
        });
    }

    [HttpGet("elections/{identifier}")]
    public async Task<IActionResult> GetElection(string identifier, [FromQuery] string? viewerAddress = null)
    {
        if (!string.IsNullOrWhiteSpace(viewerAddress) &&
            !AddressUtil.Current.IsValidEthereumAddressHexFormat(viewerAddress))
        {
            return BadRequest(new
            {
                Error = "Địa chỉ ví không hợp lệ."
            });
        }

        var election = await _electionService.GetElectionAsync(identifier, viewerAddress);
        if (election is null)
        {
            return NotFound(new
            {
                Error = "Không tìm thấy election."
            });
        }

        return Ok(election);
    }

    [HttpGet("election-groups/{identifier}")]
    public IActionResult GetElectionGroup(string identifier)
    {
        var group = _electionService.GetElectionGroup(identifier);
        if (group is null)
        {
            return NotFound(new
            {
                Error = "Khong tim thay nhom bau cu."
            });
        }

        return Ok(group);
    }

    [HttpGet("elections/{identifier}/proof")]
    public IActionResult GetProof(string identifier, [FromQuery] string address)
    {
        if (string.IsNullOrWhiteSpace(address) || !AddressUtil.Current.IsValidEthereumAddressHexFormat(address))
        {
            return BadRequest(new
            {
                Error = "Địa chỉ ví không hợp lệ."
            });
        }

        var proof = _electionService.GetProof(identifier, address);
        if (proof is null)
        {
            return NotFound(new
            {
                Error = "Không tìm thấy election hoặc proof."
            });
        }

        return Ok(proof);
    }

    [Authorize]
    [HttpPost("elections")]
    public async Task<IActionResult> CreateElection([FromBody] ElectionV1CreateRequest request, CancellationToken cancellationToken)
    {
        try
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(request.AdminWalletAddress))
            {
                return BadRequest(new
                {
                    Error = "Dia chi vi admin khong hop le."
                });
            }

            var created = await _createService.CreateElectionAsync(User, request, cancellationToken);
            var detail = await _electionService.GetElectionAsync(created.Address, request.AdminWalletAddress);

            return Ok(new
            {
                Message = "Tao election thanh cong tren Sepolia.",
                Created = created,
                Detail = detail
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [Authorize]
    [HttpPost("election-groups")]
    public async Task<IActionResult> CreateElectionGroup([FromBody] ElectionV1CreateGroupRequest request, CancellationToken cancellationToken)
    {
        try
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(request.AdminWalletAddress))
            {
                return BadRequest(new
                {
                    Error = "Dia chi vi admin khong hop le."
                });
            }

            var created = await _createService.CreateElectionGroupAsync(User, request, cancellationToken);
            var detail = _electionService.GetElectionGroup(created.GroupKey);

            return Ok(new
            {
                Message = "Tao nhom election thanh cong tren Sepolia.",
                Created = created,
                Detail = detail
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [Authorize]
    [HttpPost("roster-drafts")]
    public IActionResult CreateRosterDraft([FromBody] ElectionV1CreateRosterDraftRequest request)
    {
        try
        {
            var draft = _rosterService.CreateDraft(User, request);
            return Ok(new
            {
                Message = "Da tao roster draft cho ElectionV1.",
                Draft = draft
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [Authorize]
    [HttpGet("roster-drafts/{groupKey}")]
    public IActionResult GetRosterDraft(string groupKey)
    {
        var draft = _rosterService.GetDraft(User, groupKey);
        if (draft is null)
        {
            return NotFound(new
            {
                Error = "Khong tim thay roster draft."
            });
        }

        return Ok(draft);
    }

    [Authorize]
    [HttpPost("roster-drafts/{groupKey}/deploy")]
    public async Task<IActionResult> DeployRosterDraft(string groupKey, CancellationToken cancellationToken)
    {
        try
        {
            var created = await _rosterService.DeployDraftAsync(User, groupKey, cancellationToken);
            var detail = _electionService.GetElectionGroup(created.GroupKey);
            return Ok(new
            {
                Message = created.Message,
                Created = created,
                Detail = detail
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [AllowAnonymous]
    [HttpGet("voter-invites/resolve")]
    public IActionResult ResolveVoterInvite([FromQuery] string token)
    {
        var invite = _rosterService.ResolveInvite(token);
        if (invite is null)
        {
            return NotFound(new
            {
                Error = "Khong tim thay loi moi cu tri."
            });
        }

        return Ok(invite);
    }

    [AllowAnonymous]
    [HttpGet("voter-invites/groups/{groupKey}")]
    public IActionResult ResolveVoterInviteGroup(string groupKey)
    {
        var inviteGroup = _rosterService.ResolveRosterInviteGroup(groupKey);
        if (inviteGroup is null)
        {
            return NotFound(new
            {
                Error = "Khong tim thay roster draft."
            });
        }

        return Ok(inviteGroup);
    }

    [AllowAnonymous]
    [HttpPost("voter-invites/{token}/send-otp")]
    public async Task<IActionResult> SendVoterInviteOtp(string token, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _rosterService.SendInviteOtpAsync(token, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [AllowAnonymous]
    [HttpPost("voter-invites/groups/{groupKey}/send-otp")]
    public async Task<IActionResult> SendVoterInviteOtpByIdentity(
        string groupKey,
        [FromBody] ElectionV1RosterIdentityOtpRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _rosterService.SendInviteOtpByIdentityAsync(groupKey, request, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [AllowAnonymous]
    [HttpPost("voter-invites/{token}/verify-otp")]
    public IActionResult VerifyVoterInviteOtp(string token, [FromBody] ElectionV1OtpVerifyRequest request)
    {
        try
        {
            var result = _rosterService.VerifyInviteOtp(token, request.Otp);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [Authorize]
    [HttpPost("voter-invites/{token}/prepare-wallet-bind")]
    public IActionResult PrepareWalletBind(string token, [FromBody] ElectionV1PrepareWalletBindingRequest request)
    {
        try
        {
            var result = _rosterService.PrepareWalletBinding(User, token, request.WalletAddress);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }

    [Authorize]
    [HttpPost("voter-invites/{token}/bind-wallet")]
    public IActionResult BindVoterWallet(string token, [FromBody] ElectionV1BindWalletRequest request)
    {
        try
        {
            var result = _rosterService.BindWallet(User, token, request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new
            {
                Error = ex.Message
            });
        }
    }
}
