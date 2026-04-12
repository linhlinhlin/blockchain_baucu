using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Nethereum.Web3;
using System;
using System.Threading.Tasks;
using WebApplication3.Contracts;
using WebApplication3.Models;
using WebApplication3.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Linq;
using System.Security.Claims;
using System.Numerics;
using WebApplication3.Data;

namespace WebApplication3.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BlockchainController : ControllerBase
    {
        private readonly BlockchainService _blockchainService;
        private readonly SessionService _sessionService;
        private readonly BlockchainServerService _blockchainServerService;
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<BlockchainController> _logger;
        private readonly string _rpcUrl;
        private readonly string _factoryAddress;
        private readonly string _paymasterAddress;
        private readonly string _entryPointAddress;
        private readonly string _hluTokenAddress;

        public BlockchainController(
            BlockchainService blockchainService,
            SessionService sessionService,
            BlockchainServerService blockchainServerService,
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<BlockchainController> logger)
        {
            _blockchainService = blockchainService ?? throw new ArgumentNullException(nameof(blockchainService));
            _sessionService = sessionService ?? throw new ArgumentNullException(nameof(sessionService));
            _blockchainServerService = blockchainServerService ?? throw new ArgumentNullException(nameof(blockchainServerService));
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));

            _rpcUrl = configuration["BlockchainSettings:RpcUrl"];
            _factoryAddress = configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
            _paymasterAddress = configuration["BlockchainSettings:ContractAddresses:HLUPaymaster"];
            _entryPointAddress = configuration["BlockchainSettings:ContractAddresses:EntryPoint"];
            _hluTokenAddress = configuration["BlockchainSettings:ContractAddresses:HoLiHuToken"];

            if (string.IsNullOrEmpty(_rpcUrl))
            {
                _logger.LogError("RPC URL không được cấu hình trong appsettings.json.");
                throw new ArgumentNullException(nameof(_rpcUrl), "RPC URL không được cấu hình.");
            }

            if (string.IsNullOrEmpty(_factoryAddress))
            {
                _logger.LogError("Địa chỉ CuocBauCuFactory không được cấu hình.");
                throw new ArgumentNullException(nameof(_factoryAddress), "Địa chỉ CuocBauCuFactory không được cấu hình.");
            }

            if (string.IsNullOrEmpty(_paymasterAddress))
            {
                _logger.LogError("Địa chỉ HLUPaymaster không được cấu hình.");
                throw new ArgumentNullException(nameof(_paymasterAddress), "Địa chỉ HLUPaymaster không được cấu hình.");
            }

            if (string.IsNullOrEmpty(_entryPointAddress))
            {
                _logger.LogError("Địa chỉ EntryPoint không được cấu hình.");
                throw new ArgumentNullException(nameof(_entryPointAddress), "Địa chỉ EntryPoint không được cấu hình.");
            }

            if (string.IsNullOrEmpty(_hluTokenAddress))
            {
                _logger.LogError("Địa chỉ HoLiHuToken không được cấu hình.");
                throw new ArgumentNullException(nameof(_hluTokenAddress), "Địa chỉ HoLiHuToken không được cấu hình.");
            }
        }

        /// <summary>
        /// Lấy khóa phiên hợp lệ cho việc ký transaction ở phía client
        /// </summary>
        [HttpPost("get-session-key")]
        public async Task<IActionResult> GetSessionKey([FromBody] CreateSessionRequest request)
        {
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Yêu cầu không hợp lệ khi lấy session key: {Errors}",
                    string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                return BadRequest(ModelState);
            }

            try
            {
                // Kiểm tra TaiKhoanID từ token có khớp với request không
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != request.TaiKhoanID)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền lấy session key cho TaiKhoanId {TaiKhoanId}", userIdClaim, request.TaiKhoanID);
                    return StatusCode(403, new { Success = false, Message = "Không có quyền lấy khóa phiên cho tài khoản này." });
                }

                // Kiểm tra xem ViID có thuộc về TaiKhoanID không
                var viBlockchain = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.ViId == request.ViID && v.TaiKhoanId == request.TaiKhoanID);

                if (viBlockchain == null)
                {
                    _logger.LogWarning("Không tìm thấy ví blockchain với ViID {ViID} cho TaiKhoanID {TaiKhoanID}",
                        request.ViID, request.TaiKhoanID);
                    return NotFound(new
                    {
                        Success = false,
                        Message = "Không tìm thấy ví blockchain với ID này cho tài khoản của bạn."
                    });
                }

                // Lấy session key - SessionService sẽ tự động giải mã key từ DB
                var dto = await _sessionService.GetValidSessionKey(request.TaiKhoanID, request.ViID);

                // Nếu không có session key hợp lệ, tự động tạo mới
                if (dto == null)
                {
                    _logger.LogInformation("Không tìm thấy khóa phiên hợp lệ, tạo mới cho TaiKhoanID {TaiKhoanID}, ViID {ViID}",
                        request.TaiKhoanID, request.ViID);

                    try
                    {
                        // Tạo session key mới - SessionService sẽ giải mã key trước khi trả về
                        dto = await _sessionService.CreateSessionKey(request.TaiKhoanID, request.ViID);
                        _logger.LogInformation("Đã tạo khóa phiên mới thành công");
                    }
                    catch (Exception createEx)
                    {
                        _logger.LogError(createEx, "Lỗi khi tạo session key mới: {Error}", createEx.Message);
                        return StatusCode(500, new
                        {
                            Success = false,
                            Error = "Không thể tạo khóa phiên mới: " + createEx.Message,
                            ShouldRetry = true
                        });
                    }
                }

                if (dto == null)
                {
                    return NotFound(new { Success = false, Message = "Không thể lấy hoặc tạo khóa phiên hợp lệ." });
                }

                // Kiểm tra thời hạn
                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var remainingSeconds = dto.ExpiresAt - now;

                return Ok(new
                {
                    Success = true,
                    SessionKey = dto.SessionKey, // SessionService đã giải mã key trước khi trả về
                    ExpiresAt = dto.ExpiresAt,
                    RemainingSeconds = remainingSeconds,
                    SCWAddress = viBlockchain.DiaChiVi,
                    Timestamp = now, // Thêm timestamp hiện tại để client có thể tính toán thời gian chính xác
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy session key: {Error}", ex.Message);
                return StatusCode(500, new
                {
                    Success = false,
                    Error = "Lỗi server khi lấy khóa phiên: " + ex.Message,
                    ShouldRetry = true
                });
            }
        }

        /// <summary>
        /// Tạo khóa phiên mới cho tài khoản và ví blockchain
        /// </summary>
        [HttpPost("create-session")]
        public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Kiểm tra quyền hạn
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId) || userId != request.TaiKhoanID)
                {
                    _logger.LogWarning("Người dùng {UserId} không có quyền tạo session key cho TaiKhoanId {TaiKhoanId}", userIdClaim, request.TaiKhoanID);
                    return StatusCode(403, new { Success = false, Message = "Không có quyền tạo khóa phiên cho tài khoản này." });
                }

                // Kiểm tra ví
                var viBlockchain = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.ViId == request.ViID && v.TaiKhoanId == request.TaiKhoanID);

                if (viBlockchain == null)
                {
                    _logger.LogWarning("Không tìm thấy ví blockchain với ViID {ViID} cho TaiKhoanID {TaiKhoanID}",
                        request.ViID, request.TaiKhoanID);
                    return NotFound(new
                    {
                        Success = false,
                        Message = "Không tìm thấy ví blockchain với ID này cho tài khoản của bạn."
                    });
                }

                // Tạo session key mới - SessionService sẽ giải mã key trước khi trả về
                var dto = await _sessionService.CreateSessionKey(request.TaiKhoanID, request.ViID);

                // Kiểm tra thời hạn
                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var remainingSeconds = dto.ExpiresAt - now;

                return Ok(new
                {
                    Success = true,
                    Data = new
                    {
                        SessionKey = dto.SessionKey, // SessionService đã giải mã key trước khi trả về
                        ExpiresAt = dto.ExpiresAt,
                        RemainingSeconds = remainingSeconds,
                        SCWAddress = viBlockchain.DiaChiVi
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo session key: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Kiểm tra SCW có tồn tại không
        /// </summary>
        [HttpGet("check-scw")]
        public async Task<IActionResult> CheckSCW(string scwAddress)
        {
            if (string.IsNullOrEmpty(scwAddress))
            {
                return BadRequest(new { Success = false, Error = "Địa chỉ SCW không được để trống." });
            }

            try
            {
                var exists = await _blockchainService.CheckSCWExists(scwAddress);
                return Ok(new { Success = true, Exists = exists });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra SCW: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Lấy số dư token HLU của SCW
        /// </summary>
        [HttpGet("token-balance")]
        public async Task<IActionResult> GetTokenBalance(string scwAddress)
        {
            if (string.IsNullOrEmpty(scwAddress))
            {
                return BadRequest(new { Success = false, Error = "Địa chỉ SCW không được để trống." });
            }

            try
            {
                var balance = await _blockchainService.GetTokenBalance(scwAddress);
                return Ok(new { Success = true, Balance = balance });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy số dư token: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Kiểm tra allowance của SCW cho contract 
        /// </summary>
        [HttpGet("check-allowance")]
        public async Task<IActionResult> CheckAllowance(string scwAddress, string spenderType)
        {
            if (string.IsNullOrEmpty(scwAddress))
            {
                return BadRequest(new { Success = false, Error = "Địa chỉ SCW không được để trống." });
            }

            if (string.IsNullOrEmpty(spenderType) || (spenderType != "factory" && spenderType != "paymaster"))
            {
                return BadRequest(new { Success = false, Error = "Loại contract không hợp lệ. Chỉ chấp nhận 'factory' hoặc 'paymaster'." });
            }

            try
            {
                string spenderAddress = spenderType == "factory" ? _factoryAddress : _paymasterAddress;
                var web3 = new Web3(_rpcUrl);
                var tokenContract = web3.Eth.GetContract(ContractABIs.HoLiHuToken, _hluTokenAddress);
                var allowanceFunction = tokenContract.GetFunction("allowance");
                var allowance = await allowanceFunction.CallAsync<BigInteger>(scwAddress, spenderAddress);

                var allowanceInEther = Nethereum.Web3.Web3.Convert.FromWei(allowance);
                decimal requiredAllowance = spenderType == "factory" ? 4.0m : 1.0m;

                return Ok(new
                {
                    Success = true,
                    Allowance = allowanceInEther,
                    RequiredAllowance = requiredAllowance,
                    IsApproved = allowanceInEther >= requiredAllowance
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra allowance: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Triển khai SCW mới
        /// </summary>
        [HttpPost("deploy-scw")]
        [Authorize]
        public async Task<IActionResult> DeploySCW([FromBody] DeploySCWRequest request)
        {
            if (!ModelState.IsValid || string.IsNullOrEmpty(request.EoaAddress) || string.IsNullOrEmpty(request.Salt))
            {
                return BadRequest(new { Success = false, Error = "EOA Address hoặc Salt không hợp lệ." });
            }

            try
            {
                var scwAddress = await _blockchainService.DeploySimpleAccount(request.EoaAddress, request.Salt);
                return Ok(new { Success = true, SCWAddress = scwAddress });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi triển khai SCW: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Mint token HLU cho SCW
        /// </summary>
        [HttpPost("mint-tokens")]
        [Authorize(Roles = "Admin")] // Chỉ admin mới có quyền mint token
        public async Task<IActionResult> MintTokens([FromBody] MintTokensRequest request)
        {
            if (!ModelState.IsValid || string.IsNullOrEmpty(request.ScwAddress) || string.IsNullOrEmpty(request.Amount))
            {
                return BadRequest(new { Success = false, Error = "Địa chỉ SCW hoặc số lượng không hợp lệ." });
            }

            try
            {
                await _blockchainService.MintInitialTokens(request.ScwAddress, request.Amount);
                return Ok(new { Success = true, Message = "Mint token thành công" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi mint token: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Chuẩn bị dữ liệu để triển khai server cho cuộc bầu cử
        /// </summary>
        [HttpPost("prepare-deploy-server")]
        [Authorize]
        public async Task<IActionResult> PrepareDeployServer([FromBody] DeployServerRequest request)
        {
            if (!ModelState.IsValid || request.CuocBauCuId <= 0 || string.IsNullOrEmpty(request.ScwAddress))
            {
                return BadRequest(new { Success = false, Error = "CuocBauCuId hoặc ScwAddress không hợp lệ." });
            }

            try
            {
                // Kiểm tra quyền - người dùng chỉ có thể triển khai cuộc bầu cử của mình
                var userIdClaim = User.FindFirst("UserID")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { Success = false, Message = "Không xác định được người dùng." });
                }

                var cuocBauCu = await _context.CuocBauCus.FindAsync(request.CuocBauCuId);
                if (cuocBauCu == null)
                {
                    return NotFound(new { Success = false, Message = "Không tìm thấy cuộc bầu cử." });
                }

                if (cuocBauCu.TaiKhoanId != userId)
                {
                    return StatusCode(403, new { Success = false, Message = "Bạn không có quyền triển khai cuộc bầu cử này." });
                }

                var result = await _blockchainServerService.PrepareDeployServerForElectionAsync(request.CuocBauCuId, request.ScwAddress);
                if (result.Success)
                {
                    return Ok(new { Success = true, Data = result });
                }
                return BadRequest(new { Success = false, Error = result.ErrorMessage });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi chuẩn bị triển khai server: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Kiểm tra trạng thái triển khai server
        /// </summary>
        [HttpGet("check-server-status")]
        public async Task<IActionResult> CheckServerStatus(int cuocBauCuId)
        {
            if (cuocBauCuId <= 0)
            {
                return BadRequest(new { Success = false, Error = "CuocBauCuId không hợp lệ." });
            }

            try
            {
                var result = await _blockchainServerService.CheckServerDeploymentStatus(cuocBauCuId);
                return Ok(new { Success = result.Success, Data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra trạng thái server: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Tạo dữ liệu UserOp cho việc triển khai cuộc bầu cử
        /// </summary>
        [HttpPost("create-user-op-data")]
        public async Task<IActionResult> CreateUserOpData([FromBody] CreateUserOpDataRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var web3 = new Web3(_rpcUrl);
                var factoryContract = web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, _factoryAddress);

                // Tạo callData trực tiếp thay vì sử dụng taoUserOpTrienKhaiServer
                var innerCallData = factoryContract.GetFunction("trienKhaiServer").GetData(
                    request.TenCuocBauCu, request.ThoiGianKeoDai, request.MoTa);

                var scwContract = web3.Eth.GetContract(ContractABIs.SimpleAccountNe, request.ScwAddress);
                var executeCallData = scwContract.GetFunction("execute").GetData(
                    _factoryAddress, 0, innerCallData);

                _logger.LogInformation("Đã tạo callData cho triển khai cuộc bầu cử {TenCuocBauCu} từ SCW {SCWAddress}",
                    request.TenCuocBauCu, request.ScwAddress);

                // Lấy nonce hiện tại
                var entryPointContract = web3.Eth.GetContract(ContractABIs.EntryPoint, _entryPointAddress);
                var nonce = await entryPointContract.GetFunction("getNonce").CallAsync<BigInteger>(request.ScwAddress);

                return Ok(new
                {
                    Success = true,
                    CallData = executeCallData,
                    Nonce = nonce.ToString(),
                    FactoryAddress = _factoryAddress,
                    PaymasterAddress = _paymasterAddress,
                    EntryPointAddress = _entryPointAddress,
                    HluTokenAddress = _hluTokenAddress,
                    ChainId = _configuration.GetValue<int>("BlockchainSettings:ChainId", 210)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo dữ liệu UserOp: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        /// <summary>
        /// Lấy địa chỉ các contract cần thiết
        /// </summary>
        [HttpGet("contract-addresses")]
        public IActionResult GetContractAddresses()
        {
            try
            {
                var addresses = new
                {
                    success = true,
                    entryPointAddress = _entryPointAddress,
                    factoryAddress = _factoryAddress,
                    paymasterAddress = _paymasterAddress,
                    hluTokenAddress = _hluTokenAddress,
                    chainId = _configuration.GetValue<int>("BlockchainSettings:ChainId", 210)
                };

                _logger.LogInformation("Đã trả về địa chỉ contract. EntryPoint: {EntryPoint}, Factory: {Factory}",
                    _entryPointAddress, _factoryAddress);

                return Ok(addresses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy địa chỉ contract: {Error}", ex.Message);
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// Kiểm tra Web3 endpoint
        /// </summary>
        [HttpGet("check-rpc")]
        public async Task<IActionResult> CheckRpcEndpoint()
        {
            try
            {
                var web3 = new Web3(_rpcUrl);
                var blockNumber = await web3.Eth.Blocks.GetBlockNumber.SendRequestAsync();
                var gasPrice = await web3.Eth.GasPrice.SendRequestAsync();

                return Ok(new
                {
                    Success = true,
                    BlockNumber = blockNumber.Value.ToString(),
                    GasPrice = Nethereum.Web3.Web3.Convert.FromWei(gasPrice, Nethereum.Util.UnitConversion.EthUnit.Gwei),
                    GasPriceUnit = "Gwei"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra RPC endpoint: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }
        /// <summary>
        /// Kiểm tra allowance của SCW cho một địa chỉ contract cụ thể
        /// </summary>
        [HttpGet("check-contract-allowance")]
        public async Task<IActionResult> CheckContractAllowance(string scwAddress, string contractAddress)
        {
            if (string.IsNullOrEmpty(scwAddress))
            {
                return BadRequest(new { Success = false, Error = "Địa chỉ SCW không được để trống." });
            }

            if (string.IsNullOrEmpty(contractAddress))
            {
                return BadRequest(new { Success = false, Error = "Địa chỉ contract không được để trống." });
            }

            try
            {
                var web3 = new Web3(_rpcUrl);
                var tokenContract = web3.Eth.GetContract(ContractABIs.HoLiHuToken, _hluTokenAddress);
                var allowanceFunction = tokenContract.GetFunction("allowance");
                var allowance = await allowanceFunction.CallAsync<BigInteger>(scwAddress, contractAddress);

                var allowanceInEther = Nethereum.Web3.Web3.Convert.FromWei(allowance);
                decimal requiredAllowance = 5.0m; // Yêu cầu ít nhất 5 HLU cho cuộc bầu cử

                return Ok(new
                {
                    Success = true,
                    Allowance = allowanceInEther,
                    RequiredAllowance = requiredAllowance,
                    IsApproved = allowanceInEther >= requiredAllowance
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra allowance cho contract {ContractAddress}: {Error}", contractAddress, ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }
    }

    // Request models
    public class CreateSessionRequest
    {
        public int TaiKhoanID { get; set; }
        public int ViID { get; set; }
    }

    public class CreateUserOpDataRequest
    {
        public string ScwAddress { get; set; }
        public string TenCuocBauCu { get; set; }
        public long ThoiGianKeoDai { get; set; }
        public string MoTa { get; set; }
    }

    public class DeploySCWRequest
    {
        public string EoaAddress { get; set; }
        public string Salt { get; set; }
    }

    public class MintTokensRequest
    {
        public string ScwAddress { get; set; }
        public string Amount { get; set; }
    }

    public class DeployServerRequest
    {
        public int CuocBauCuId { get; set; }
        public string ScwAddress { get; set; }
    }
}