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

    public ElectionV1Controller(ElectionV1ReadService electionService, ElectionV1CreateService createService)
    {
        _electionService = electionService;
        _createService = createService;
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
}
