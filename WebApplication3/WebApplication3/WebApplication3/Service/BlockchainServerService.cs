using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Web3;
using System;
using System.Linq;
using System.Numerics;
using System.Threading.Tasks;
using WebApplication3.Contracts;
using WebApplication3.Data;
using WebApplication3.Models;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.JsonRpc.Client;
using System.Text;
using Microsoft.AspNetCore.Http; // Thêm namespace cho IFormFile
using System.IO;
using System.Security.Cryptography;
using System.Threading;
using Microsoft.Extensions.DependencyInjection;
using Nethereum.ABI.FunctionEncoding.Attributes;

namespace WebApplication3.Services
{
    public class BlockchainServerService
    {
        private readonly ApplicationDbContext _context;
        private readonly BlockchainService _blockchainService;
        private readonly ILogger<BlockchainServerService> _logger;
        private readonly string _factoryAddress;
        private readonly string _rpcUrl;
        private readonly string _paymasterAddress;
        private readonly string _hluTokenAddress;
        private readonly IAzureBlobService _azureBlobService;
        private readonly IConfiguration _configuration; // Đảm bảo _configuration là một field
        private readonly Web3 _web3; // Thêm field Web3 để tái sử dụng instance
        private readonly IServiceProvider _serviceProvider; // Thay đổi: Sử dụng IServiceProvider thay vì IDbContextFactory

        // Thêm counter để đảm bảo transaction hash không trùng lặp
        private static int _transactionCounter = 0;

        // Thêm các tham số gas cố định từ script test thành công
        private BigInteger FIXED_CALL_GAS_LIMIT = 1407976;
        private BigInteger FIXED_VERIFICATION_GAS_LIMIT = 600000;
        private BigInteger FIXED_PRE_VERIFICATION_GAS = 210000;

        public BlockchainServerService(
             ApplicationDbContext context,
             BlockchainService blockchainService,
             ILogger<BlockchainServerService> logger,
             IConfiguration configuration,
             IAzureBlobService azureBlobService,
             IServiceProvider serviceProvider) // Thay đổi: Sử dụng IServiceProvider
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _blockchainService = blockchainService ?? throw new ArgumentNullException(nameof(blockchainService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration)); // Lưu _configuration
            _azureBlobService = azureBlobService ?? throw new ArgumentNullException(nameof(azureBlobService));
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider)); // Khởi tạo _serviceProvider

            _rpcUrl = configuration["BlockchainSettings:RpcUrl"];
            if (string.IsNullOrEmpty(_rpcUrl))
            {
                _logger.LogError("RPC URL không được cấu hình trong appsettings.json.");
                throw new ArgumentNullException(nameof(_rpcUrl), "RPC URL không được cấu hình.");
            }

            _factoryAddress = configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
            if (string.IsNullOrEmpty(_factoryAddress))
            {
                _logger.LogError("Địa chỉ CuocBauCuFactory không được cấu hình.");
                throw new ArgumentNullException(nameof(_factoryAddress), "Địa chỉ CuocBauCuFactory không được cấu hình.");
            }

            _paymasterAddress = configuration["BlockchainSettings:ContractAddresses:HLUPaymaster"];
            if (string.IsNullOrEmpty(_paymasterAddress))
            {
                _logger.LogError("Địa chỉ HLUPaymaster không được cấu hình.");
                throw new ArgumentNullException(nameof(_paymasterAddress), "Địa chỉ HLUPaymaster không được cấu hình.");
            }

            _hluTokenAddress = configuration["BlockchainSettings:ContractAddresses:HoLiHuToken"];
            if (string.IsNullOrEmpty(_hluTokenAddress))
            {
                _logger.LogError("Địa chỉ HoLiHuToken không được cấu hình.");
                throw new ArgumentNullException(nameof(_hluTokenAddress), "Địa chỉ HoLiHuToken không được cấu hình.");
            }

            // Khởi tạo Web3 instance một lần
            _web3 = new Web3(_rpcUrl);
        }

        // Phương thức cải tiến để tạo callData đáng tin cậy
        private async Task<string> CreateCallDataForElection(string scwAddress, string tenCuocBauCu, long thoiGianKeoDai, string moTa)
        {
            try
            {
                _logger.LogInformation("Tạo callData thủ công cho việc triển khai server...");

                // Kiểm tra đầu vào
                if (string.IsNullOrEmpty(scwAddress) || string.IsNullOrEmpty(tenCuocBauCu))
                {
                    throw new ArgumentException("SCW address hoặc tên cuộc bầu cử không được để trống");
                }

                // Đảm bảo SCW có định dạng địa chỉ Ethereum hợp lệ
                if (!scwAddress.StartsWith("0x") || scwAddress.Length != 42)
                {
                    throw new ArgumentException($"Địa chỉ SCW không hợp lệ: {scwAddress}");
                }

                // Chuẩn bị mô tả mặc định nếu trống
                string finalMoTa = string.IsNullOrEmpty(moTa) ? "Không có mô tả" : moTa;

                // Kiểm tra thoiGianKeoDai hợp lệ
                if (thoiGianKeoDai <= 0)
                {
                    _logger.LogWarning("thoiGianKeoDai không hợp lệ: {Duration}, sử dụng mặc định 7 ngày", thoiGianKeoDai);
                    thoiGianKeoDai = 7 * 24 * 60 * 60; // 7 ngày
                }

                // Tạo contract instances
                var factoryContract = _web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, _factoryAddress);
                var scwContract = _web3.Eth.GetContract(ContractABIs.SimpleAccountNe, scwAddress);

                _logger.LogInformation("Gọi taoUserOpTrienKhaiServer từ Factory...");

                // Ưu tiên dùng phương thức taoUserOpTrienKhaiServer từ Factory
                try
                {
                    var result = await factoryContract.GetFunction("taoUserOpTrienKhaiServer").CallDeserializingToObjectAsync<UserOpRawData>(
                        scwAddress, tenCuocBauCu, thoiGianKeoDai, finalMoTa);

                    if (result != null && !string.IsNullOrEmpty(result.CallData))
                    {
                        _logger.LogInformation("Đã nhận callData từ Factory thành công");
                        return result.CallData;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Không thể dùng taoUserOpTrienKhaiServer: {Error}. Thử phương pháp thủ công.", ex.Message);
                }

                // Fallback: Tạo callData thủ công
                _logger.LogInformation("Tạo innerCallData cho trienKhaiServer với tham số: Tên={TenCuocBauCu}, ThoiGian={ThoiGian}, MoTa={MoTa}",
                    tenCuocBauCu, thoiGianKeoDai, finalMoTa);

                // ===== CÁCH SỬA LỖI: SỬ DỤNG ENCODEFUNCTIONCALL TRỰC TIẾP =====

                // Định nghĩa function signature và tham số
                string functionSignature = "trienKhaiServer(string,uint256,string)";
                Nethereum.ABI.Model.Parameter[] parameters = new Nethereum.ABI.Model.Parameter[]
                {
                    new Nethereum.ABI.Model.Parameter("string", "tenCuocBauCu"),
                    new Nethereum.ABI.Model.Parameter("uint256", "thoiGianKeoDai"),
                    new Nethereum.ABI.Model.Parameter("string", "moTa")
                };

                // Sử dụng encoder trực tiếp để tránh vấn đề với ABI
                var encoder = new Nethereum.ABI.FunctionEncoding.FunctionCallEncoder();
                var innerCallData = encoder.EncodeRequest(
                    Nethereum.Util.Sha3Keccack.Current.CalculateHash(functionSignature).Substring(0, 10),
                    parameters,
                    new object[]
                    {
                        tenCuocBauCu,
                        new BigInteger(thoiGianKeoDai),
                        finalMoTa
                    }
                );

                _logger.LogInformation("InnerCallData được tạo");

                // Đóng gói để gọi qua execute của SCW
                string callData = scwContract.GetFunction("execute").GetData(
                    _factoryAddress,
                    BigInteger.Zero, // Không gửi ETH
                    innerCallData);

                _logger.LogInformation("Đã tạo callData thành công");

                return callData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo callData: {Error}", ex.Message);
                throw new Exception($"Lỗi khi tạo callData: {ex.Message}", ex);
            }
        }

        public async Task<BlockchainDeployResult> DeployServerWithCallDataAsync(int cuocBauCuId, string scwAddress, string callData)
        {
            var result = new BlockchainDeployResult();

            try
            {
                // Lấy thông tin cuộc bầu cử
                var cuocBauCu = await _context.CuocBauCus
                    .Include(c => c.TaiKhoan)
                    .FirstOrDefaultAsync(c => c.Id == cuocBauCuId);

                if (cuocBauCu == null)
                {
                    _logger.LogError("Không tìm thấy cuộc bầu cử ID: {CuocBauCuId}", cuocBauCuId);
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy cuộc bầu cử";
                    return result;
                }

                if (cuocBauCu.TrangThaiBlockchain == 2)
                {
                    _logger.LogWarning("Cuộc bầu cử ID: {CuocBauCuId} đã được triển khai", cuocBauCuId);
                    result.Success = true;
                    result.BlockchainServerId = cuocBauCu.BlockchainServerId.GetValueOrDefault();
                    result.BlockchainAddress = cuocBauCu.BlockchainAddress;
                    result.Status = 2;
                    return result;
                }

                bool scwExists = await _blockchainService.CheckSCWExists(scwAddress);
                if (!scwExists)
                {
                    _logger.LogError("SCW không tồn tại tại địa chỉ: {SCWAddress}", scwAddress);
                    result.Success = false;
                    result.ErrorMessage = "SCW không tồn tại";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = "SCW không tồn tại";
                    await _context.SaveChangesAsync();
                    return result;
                }

                // Tìm ví SCW trong database
                var viSCW = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.DiaChiVi.ToLower() == scwAddress.ToLower() && v.TaiKhoanId == cuocBauCu.TaiKhoanId);
                if (viSCW == null)
                {
                    _logger.LogError("Không tìm thấy ví blockchain cho SCW {SCWAddress}", scwAddress);
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy ví blockchain";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = "Không tìm thấy ví blockchain";
                    await _context.SaveChangesAsync();
                    return result;
                }

                // Lấy session key hiện tại
                var sessionServiceLogger = _logger.CreateScope<SessionService>();
                var sessionService = new SessionService(_context, sessionServiceLogger, _configuration);
                var sessionKey = await sessionService.GetValidSessionKeyEntity(cuocBauCu.TaiKhoanId ?? 0, viSCW.ViId);

                if (sessionKey == null)
                {
                    _logger.LogError("Không tìm thấy session key hợp lệ cho TaiKhoanId: {TaiKhoanId}, ViId: {ViId}", cuocBauCu.TaiKhoanId, viSCW.ViId);

                    try
                    {
                        // Thử tạo session key mới
                        await sessionService.CreateSessionKey(cuocBauCu.TaiKhoanId ?? 0, viSCW.ViId);
                        _logger.LogInformation("Đã tạo session key mới cho TaiKhoanId: {TaiKhoanId}, ViId: {ViId}", cuocBauCu.TaiKhoanId, viSCW.ViId);
                        sessionKey = await sessionService.GetValidSessionKeyEntity(cuocBauCu.TaiKhoanId ?? 0, viSCW.ViId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi tạo session key mới");
                        result.Success = false;
                        result.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        cuocBauCu.TrangThaiBlockchain = 3;
                        cuocBauCu.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        await _context.SaveChangesAsync();
                        return result;
                    }

                    if (sessionKey == null)
                    {
                        result.Success = false;
                        result.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        cuocBauCu.TrangThaiBlockchain = 3;
                        cuocBauCu.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        await _context.SaveChangesAsync();
                        return result;
                    }
                }

                // Tạo transaction hash hợp lệ cho Ethereum
                string transactionHash = GenerateValidTransactionHash();

                // Tạo và lưu giao dịch BlockchainTransaction
                var transaction = new BlockchainTransaction
                {
                    TransactionHash = transactionHash,
                    LoaiGiaoDich = "DEPLOY_SERVER",
                    TrangThai = 0, // Pending
                    NgayTao = DateTime.UtcNow,
                    DoiTuongId = cuocBauCuId,
                    LoaiDoiTuong = "CuocBauCu",
                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        SCWAddress = scwAddress,
                        TenCuocBauCu = cuocBauCu.TenCuocBauCu,
                        ThoiGianKeoDai = (long)(cuocBauCu.NgayKetThuc - cuocBauCu.NgayBatDau).TotalSeconds,
                        MoTa = cuocBauCu.MoTa ?? "Không có mô tả",
                        CallDataFromFrontend = true
                    })
                };

                _context.BlockchainTransactions.Add(transaction);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Tạo giao dịch với transaction hash tạm thời: {TxHash}", transactionHash);

                // Sử dụng callData được cung cấp từ front-end
                _logger.LogInformation("Sử dụng callData được cung cấp từ front-end");

                // Lấy EntryPoint contract
                var entryPointAddress = _configuration["BlockchainSettings:ContractAddresses:EntryPoint"];
                var entryPointContract = _web3.Eth.GetContract(ContractABIs.EntryPoint, entryPointAddress);

                // Lấy nonce hiện tại
                var nonce = await entryPointContract.GetFunction("getNonce").CallAsync<BigInteger>(scwAddress);

                // Đây là phần quan trọng: Sử dụng callData từ front-end thay vì tạo mới
                // Tạo UserOperation với tham số giống script test thành công
                var userOp = new UserOperation
                {
                    Sender = scwAddress,
                    Nonce = nonce,
                    InitCode = "0x",
                    CallData = callData,
                    CallGasLimit = FIXED_CALL_GAS_LIMIT,  // Giá trị từ script test thành công
                    VerificationGasLimit = FIXED_VERIFICATION_GAS_LIMIT,
                    PreVerificationGas = FIXED_PRE_VERIFICATION_GAS,
                    MaxFeePerGas = Web3.Convert.ToWei(5, Nethereum.Util.UnitConversion.EthUnit.Gwei),
                    MaxPriorityFeePerGas = Web3.Convert.ToWei(2, Nethereum.Util.UnitConversion.EthUnit.Gwei),
                    PaymasterAndData = _paymasterAddress, // Chỉ trả về địa chỉ paymaster, không có data
                    Signature = "0x"
                };

                // Ký UserOperation bằng session key
                _logger.LogInformation("Ký UserOperation bằng session key");
                var userOpHash = await entryPointContract.GetFunction("layHashThaoTac").CallAsync<string>(userOp);
                var signingKey = new Nethereum.Signer.EthECKey(sessionKey.Khoa);
                var ecdsaSignature = signingKey.Sign(Nethereum.Util.Sha3Keccack.Current.CalculateHash(Encoding.UTF8.GetBytes(userOpHash)));
                string signature = "0x" +
                                  BitConverter.ToString(ecdsaSignature.R).Replace("-", "").ToLowerInvariant() +
                                  BitConverter.ToString(ecdsaSignature.S).Replace("-", "").ToLowerInvariant() +
                                  (ecdsaSignature.V[0] < 27 ? (ecdsaSignature.V[0] + 27).ToString("x2") : ecdsaSignature.V[0].ToString("x2"));
                userOp.Signature = signature;

                _logger.LogInformation("Đã ký UserOperation, userOpHash: {UserOpHash}", userOpHash);

                // Gửi UserOperation đến bundler
                _logger.LogInformation("Gửi UserOperation đến bundler");
                var bundlerServiceLogger = _logger.CreateScope<BundlerService>();

                // Thay đổi: Sử dụng IServiceProvider để tạo BundlerService
                var bundlerService = new BundlerService(
                    _configuration,
                    bundlerServiceLogger,
                    _blockchainService,
                    _serviceProvider); // Truyền IServiceProvider thay vì IDbContextFactory

                // Thêm UserOpHash từ backend vào UserOperation 
                userOp.UserOpHash = userOpHash;

                var status = await bundlerService.SendUserOperation(userOp);
                _logger.LogInformation("Kết quả gửi UserOperation: {Status}", status);

                // Cập nhật transaction hash nếu có
                if (status.StartsWith("bundling") || status.StartsWith("pending"))
                {
                    // Cập nhật với hash thực tế từ UserOperation
                    transaction.TransactionHash = userOpHash;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Cập nhật transaction hash từ userOpHash: {Hash}", userOpHash);

                    // Cập nhật thông tin cuộc bầu cử
                    cuocBauCu.BlockchainAddress = scwAddress;
                    await _context.SaveChangesAsync();

                    result.Success = true;
                    result.TransactionHash = userOpHash;
                    result.BlockchainAddress = scwAddress;
                    result.Status = 1;

                    _logger.LogInformation("Triển khai thành công, đang chờ xác nhận. UserOpHash: {UserOpHash}", userOpHash);
                }
                else
                {
                    _logger.LogError("Lỗi khi gửi UserOperation: {Status}", status);
                    result.Success = false;
                    result.ErrorMessage = $"Lỗi khi gửi UserOperation: {status}";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = result.ErrorMessage;
                    transaction.TrangThai = 2; // Thất bại
                    await _context.SaveChangesAsync();
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi triển khai server với callData cho cuộc bầu cử: {CuocBauCuId}", cuocBauCuId);
                result.Success = false;
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        // Phương thức cải tiến để tạo transaction hash đúng chuẩn Ethereum
        private string GenerateValidTransactionHash()
        {
            try
            {
                using (SHA256 sha256 = SHA256.Create())
                {
                    // Tạo mảng byte ngẫu nhiên với thêm entropy
                    byte[] randomBytes = new byte[32];
                    byte[] timeBytes = BitConverter.GetBytes(DateTime.UtcNow.Ticks);
                    byte[] counterBytes = BitConverter.GetBytes(Interlocked.Increment(ref _transactionCounter));

                    using (var rng = RandomNumberGenerator.Create())
                    {
                        rng.GetBytes(randomBytes);
                    }

                    // Kết hợp các nguồn entropy
                    using (var ms = new MemoryStream())
                    {
                        ms.Write(randomBytes, 0, randomBytes.Length);
                        ms.Write(timeBytes, 0, timeBytes.Length);
                        ms.Write(counterBytes, 0, counterBytes.Length);

                        // Hash kết quả
                        byte[] combinedBytes = ms.ToArray();
                        byte[] hashBytes = sha256.ComputeHash(combinedBytes);

                        // Chuyển đổi thành chuỗi hex với tiền tố 0x
                        string hash = "0x" + BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();

                        // Kiểm tra điều kiện hợp lệ của transaction hash
                        if (hash.Length != 66 || !hash.StartsWith("0x"))
                        {
                            _logger.LogWarning("Tạo hash không hợp lệ: {Hash}, độ dài {Length}. Thử lại.", hash, hash.Length);
                            // Thử lại
                            return GenerateValidTransactionHash();
                        }

                        _logger.LogInformation("Đã tạo transaction hash hợp lệ: {Hash}", hash);
                        return hash;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo transaction hash, sử dụng phương pháp dự phòng");

                // Phương pháp dự phòng đơn giản
                string hash = "0x" + Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
                hash = hash.Substring(0, 66); // Đảm bảo độ dài 66 ký tự (bao gồm "0x")
                _logger.LogInformation("Đã tạo transaction hash dự phòng: {Hash}", hash);
                return hash;
            }
        }

        public async Task<BlockchainDeployPrepareResult> PrepareDeployServerForElectionAsync(int cuocBauCuId, string scwAddress)
        {
            var result = new BlockchainDeployPrepareResult();

            try
            {
                var cuocBauCu = await _context.CuocBauCus
                    .Include(c => c.TaiKhoan)
                    .FirstOrDefaultAsync(c => c.Id == cuocBauCuId);

                if (cuocBauCu == null)
                {
                    _logger.LogError("Không tìm thấy cuộc bầu cử ID: {CuocBauCuId}", cuocBauCuId);
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy cuộc bầu cử";
                    return result;
                }

                if (cuocBauCu.TrangThaiBlockchain == 2)
                {
                    _logger.LogWarning("Cuộc bầu cử ID: {CuocBauCuId} đã được triển khai", cuocBauCuId);
                    result.Success = true;
                    result.BlockchainServerId = cuocBauCu.BlockchainServerId.GetValueOrDefault();
                    result.BlockchainAddress = cuocBauCu.BlockchainAddress;
                    return result;
                }

                bool scwExists = await _blockchainService.CheckSCWExists(scwAddress);
                if (!scwExists)
                {
                    _logger.LogError("SCW không tồn tại tại địa chỉ: {SCWAddress}", scwAddress);
                    result.Success = false;
                    result.ErrorMessage = "SCW không tồn tại";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = "SCW không tồn tại";
                    await _context.SaveChangesAsync();
                    return result;
                }

                var vi = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.DiaChiVi.ToLower() == scwAddress.ToLower() && v.TaiKhoanId == cuocBauCu.TaiKhoanId);
                if (vi == null)
                {
                    _logger.LogError("Không tìm thấy ví blockchain cho SCW {SCWAddress}", scwAddress);
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy ví blockchain";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = "Không tìm thấy ví blockchain";
                    await _context.SaveChangesAsync();
                    return result;
                }

                var web3Instance = new Web3(_rpcUrl);
                var hluTokenContract = web3Instance.Eth.GetContract(ContractABIs.HoLiHuToken, _hluTokenAddress);

                // Kiểm tra số dư HLU của SCW
                var hluBalance = await hluTokenContract.GetFunction("balanceOf").CallAsync<BigInteger>(scwAddress);
                var minTotalHLU = Web3.Convert.ToWei(1m); // Tối thiểu 1 HLU cho giao dịch chính
                if (hluBalance < minTotalHLU)
                {
                    _logger.LogError("SCW {SCWAddress} không đủ HLU. Cần tối thiểu: {Required} HLU, Hiện có: {Balance} HLU",
                        scwAddress, Web3.Convert.FromWei(minTotalHLU), Web3.Convert.FromWei(hluBalance));
                    result.Success = false;
                    result.ErrorMessage = $"SCW không đủ HLU. Cần tối thiểu {Web3.Convert.FromWei(minTotalHLU)} HLU";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = result.ErrorMessage;
                    await _context.SaveChangesAsync();
                    return result;
                }

                // Kiểm tra allowance và chuẩn bị callData phê duyệt nếu cần
                var approvalData = await PrepareApproveTokensIfNeeded(scwAddress, hluTokenContract);

                // Tính toán thời gian kéo dài theo giây
                long thoiGianKeoDai;
                try
                {
                    TimeSpan duration = cuocBauCu.NgayKetThuc - cuocBauCu.NgayBatDau;
                    thoiGianKeoDai = (long)duration.TotalSeconds;

                    // Kiểm tra tính hợp lệ
                    if (thoiGianKeoDai <= 0)
                    {
                        _logger.LogWarning("Thời gian kéo dài không hợp lệ: {Duration} giây. Sử dụng giá trị mặc định 7 ngày.", thoiGianKeoDai);
                        thoiGianKeoDai = 7 * 24 * 60 * 60; // 7 ngày nếu thời gian không hợp lệ
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tính thời gian kéo dài cho cuộc bầu cử ID {CuocBauCuId}. Sử dụng giá trị mặc định.", cuocBauCuId);
                    thoiGianKeoDai = 7 * 24 * 60 * 60; // 7 ngày nếu tính toán lỗi
                }

                _logger.LogInformation("Chuẩn bị dữ liệu cho cuộc bầu cử: {Ten}, thời gian: {ThoiGian} giây",
                    cuocBauCu.TenCuocBauCu, thoiGianKeoDai);

                // Trả dữ liệu thô cho front-end
                result.Success = true;
                result.TaiKhoanId = (int)cuocBauCu.TaiKhoanId;
                result.ViId = vi.ViId;
                result.FactoryAddress = _factoryAddress;
                result.PaymasterAddress = _paymasterAddress;
                result.TenCuocBauCu = cuocBauCu.TenCuocBauCu;
                result.ThoiGianKeoDai = thoiGianKeoDai;
                result.MoTa = cuocBauCu.MoTa ?? "Không có mô tả";
                result.BlockchainAddress = scwAddress;
                result.ApprovalCallData = approvalData;

                // Thêm thông tin gas cố định từ script test thành công
                result.CallGasLimit = FIXED_CALL_GAS_LIMIT.ToString();
                result.VerificationGasLimit = FIXED_VERIFICATION_GAS_LIMIT.ToString();
                result.PreVerificationGas = FIXED_PRE_VERIFICATION_GAS.ToString();

                // Cập nhật trạng thái trong DB
                cuocBauCu.TrangThaiBlockchain = 1;
                cuocBauCu.BlockchainAddress = scwAddress;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Đã chuẩn bị dữ liệu triển khai server cho CuocBauCuId {CuocBauCuId}", cuocBauCuId);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi chuẩn bị triển khai server cho CuocBauCuId {CuocBauCuId}", cuocBauCuId);
                result.Success = false;
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        private async Task<ApprovalCallData> PrepareApproveTokensIfNeeded(string scwAddress, Nethereum.Contracts.Contract hluTokenContract)
        {
            var approvalData = new ApprovalCallData();

            // Kiểm tra allowance cho Factory
            var allowanceForFactory = await hluTokenContract.GetFunction("allowance")
                .CallAsync<BigInteger>(scwAddress, _factoryAddress);
            var minFactoryAllowance = Web3.Convert.ToWei(4m); // 4 HLU

            if (allowanceForFactory < minFactoryAllowance)
            {
                _logger.LogInformation("Chuẩn bị callData phê duyệt HLU cho Factory. SCW: {SCWAddress}", scwAddress);
                approvalData.FactoryApprovalCallData = await PrepareApproveToken(scwAddress, _factoryAddress, 8); // Phê duyệt 8 HLU
            }

            // Kiểm tra allowance cho Paymaster
            var allowanceForPaymaster = await hluTokenContract.GetFunction("allowance")
                .CallAsync<BigInteger>(scwAddress, _paymasterAddress);
            var minPaymasterAllowance = Web3.Convert.ToWei(1m); // 1 HLU

            if (allowanceForPaymaster < minPaymasterAllowance)
            {
                _logger.LogInformation("Chuẩn bị callData phê duyệt HLU cho Paymaster. SCW: {SCWAddress}", scwAddress);
                approvalData.PaymasterApprovalCallData = await PrepareApproveToken(scwAddress, _paymasterAddress, 2); // Phê duyệt 2 HLU
            }

            return approvalData;
        }

        private async Task<string> PrepareApproveToken(string scwAddress, string spender, int amountInHLU)
        {
            var web3Client = new Web3(_rpcUrl);
            var hluTokenContract = web3Client.Eth.GetContract(ContractABIs.HoLiHuToken, _hluTokenAddress);
            var approveFunction = hluTokenContract.GetFunction("approve");

            var amountInWei = Web3.Convert.ToWei(amountInHLU);
            var approveCallData = approveFunction.GetData(spender, amountInWei);
            var executeCallData = web3Client.Eth.GetContract(ContractABIs.SimpleAccountNe, scwAddress)
                .GetFunction("execute").GetData(_hluTokenAddress, BigInteger.Zero, approveCallData);

            _logger.LogInformation("Đã tạo callData phê duyệt {Amount} HLU từ {SCWAddress} cho {Spender}",
                amountInHLU, scwAddress, spender);
            return executeCallData;
        }

        public async Task<BlockchainDeployResult> CheckServerDeploymentStatus(int cuocBauCuId)
        {
            var result = new BlockchainDeployResult();

            try
            {
                var cuocBauCu = await _context.CuocBauCus.FindAsync(cuocBauCuId);
                if (cuocBauCu == null)
                {
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy cuộc bầu cử";
                    return result;
                }

                // Lấy giao dịch DEPLOY_SERVER gần nhất
                var transaction = await _context.BlockchainTransactions
                    .Where(t => t.DoiTuongId == cuocBauCuId && t.LoaiDoiTuong == "CuocBauCu" && t.LoaiGiaoDich == "DEPLOY_SERVER")
                    .OrderByDescending(t => t.NgayTao)
                    .FirstOrDefaultAsync();

                result.Status = cuocBauCu.TrangThaiBlockchain;
                result.BlockchainServerId = cuocBauCu.BlockchainServerId.GetValueOrDefault();
                result.BlockchainAddress = cuocBauCu.BlockchainAddress;
                result.ErrorMessage = cuocBauCu.ErrorMessage;
                result.Success = cuocBauCu.TrangThaiBlockchain == 2;

                if (transaction != null)
                {
                    result.TransactionHash = transaction.TransactionHash;

                    // Tìm actualTxHash trong metadata
                    string actualTxHash = null;

                    try
                    {
                        if (!string.IsNullOrEmpty(transaction.MetaData))
                        {
                            var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);
                            if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                            {
                                actualTxHash = txHashElement.GetString();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Không thể parse metadata: {Error}", ex.Message);
                    }

                    // Nếu tìm thấy actualTxHash, kiểm tra trạng thái giao dịch
                    if (!string.IsNullOrEmpty(actualTxHash) && actualTxHash.StartsWith("0x") && actualTxHash.Length == 66)
                    {
                        try
                        {
                            var web3Client = new Web3(_rpcUrl);
                            var receipt = await web3Client.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(actualTxHash);

                            if (receipt != null)
                            {
                                transaction.BlockNumber = (long)receipt.BlockNumber.Value;

                                if (receipt.Status.Value == 1)
                                {
                                    // Giao dịch thành công
                                    cuocBauCu.TrangThaiBlockchain = 2; // Đã triển khai
                                    transaction.TrangThai = 1; // Success

                                    _logger.LogInformation("Giao dịch {TxHash} thành công cho CuocBauCuId {CuocBauCuId}",
                                        actualTxHash, cuocBauCuId);

                                    await _context.SaveChangesAsync();

                                    result.Status = cuocBauCu.TrangThaiBlockchain;
                                    result.Success = true;
                                    result.TransactionHash = actualTxHash;
                                    return result;
                                }
                                else
                                {
                                    // Giao dịch thất bại
                                    cuocBauCu.TrangThaiBlockchain = 3; // Thất bại
                                    transaction.TrangThai = 2; // Failed
                                    cuocBauCu.ErrorMessage = "Giao dịch blockchain thất bại";

                                    _logger.LogWarning("Giao dịch {TxHash} thất bại cho CuocBauCuId {CuocBauCuId}",
                                        actualTxHash, cuocBauCuId);

                                    await _context.SaveChangesAsync();

                                    result.Status = cuocBauCu.TrangThaiBlockchain;
                                    result.Success = false;
                                    result.ErrorMessage = "Giao dịch blockchain thất bại";
                                    return result;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Lỗi kiểm tra receipt: {Error}", ex.Message);
                        }
                    }

                    // Kiểm tra hash trực tiếp nếu không tìm thấy actualTxHash
                    if (transaction.TransactionHash.StartsWith("0x") && transaction.TransactionHash.Length == 66)
                    {
                        try
                        {
                            var web3Client = new Web3(_rpcUrl);
                            var receipt = await web3Client.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(transaction.TransactionHash);

                            if (receipt != null)
                            {
                                transaction.BlockNumber = (long)receipt.BlockNumber.Value;

                                if (receipt.Status.Value == 1)
                                {
                                    cuocBauCu.TrangThaiBlockchain = 2; // Đã triển khai
                                    transaction.TrangThai = 1; // Success

                                    await _context.SaveChangesAsync();

                                    result.Status = cuocBauCu.TrangThaiBlockchain;
                                    result.Success = true;
                                    return result;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Lỗi kiểm tra receipt: {Error}", ex.Message);
                        }
                    }
                }

                // Kiểm tra các UserOperation khác có thể liên quan
                var userOps = await _context.BlockchainTransactions
                    .Where(t => t.LoaiGiaoDich == "USER_OPERATION" &&
                           (t.MetaData.Contains(cuocBauCuId.ToString()) ||
                            (t.LoaiDoiTuong == "UserOperation" && t.DoiTuongId == cuocBauCuId)))
                    .ToListAsync();

                foreach (var userOp in userOps)
                {
                    string actualTxHash = null;

                    try
                    {
                        if (!string.IsNullOrEmpty(userOp.MetaData))
                        {
                            var metadata = System.Text.Json.JsonDocument.Parse(userOp.MetaData);
                            if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                            {
                                actualTxHash = txHashElement.GetString();
                            }
                        }
                    }
                    catch { }

                    if (!string.IsNullOrEmpty(actualTxHash) && actualTxHash.StartsWith("0x") && actualTxHash.Length == 66)
                    {
                        try
                        {
                            var web3Client = new Web3(_rpcUrl);
                            var receipt = await web3Client.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(actualTxHash);

                            if (receipt != null && receipt.Status.Value == 1)
                            {
                                // Tạo bản ghi DEPLOY_SERVER từ thông tin này
                                var newTransaction = new BlockchainTransaction
                                {
                                    TransactionHash = userOp.TransactionHash,
                                    LoaiGiaoDich = "DEPLOY_SERVER",
                                    TrangThai = 1, // Success
                                    NgayTao = userOp.NgayTao,
                                    NgayCapNhat = DateTime.UtcNow,
                                    DoiTuongId = cuocBauCuId,
                                    LoaiDoiTuong = "CuocBauCu",
                                    BlockNumber = (long)receipt.BlockNumber.Value,
                                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                                    {
                                        userOpHash = userOp.TransactionHash,
                                        actualTxHash = actualTxHash,
                                        recovered = true
                                    })
                                };

                                _context.BlockchainTransactions.Add(newTransaction);
                                cuocBauCu.TrangThaiBlockchain = 2; // Đã triển khai

                                await _context.SaveChangesAsync();

                                _logger.LogInformation("Đã phục hồi giao dịch thành công cho CuocBauCuId {CuocBauCuId} từ UserOperation",
                                    cuocBauCuId);

                                result.Status = cuocBauCu.TrangThaiBlockchain;
                                result.Success = true;
                                result.TransactionHash = actualTxHash;
                                return result;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Lỗi kiểm tra receipt từ UserOperation: {Error}", ex.Message);
                        }
                    }
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra trạng thái triển khai server: {Error}", ex.Message);
                result.Success = false;
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        public async Task<BlockchainDeployResult> DeployServerForElectionAsync(int cuocBauCuId, string scwAddress)
        {
            var result = new BlockchainDeployResult();

            try
            {
                // Lấy thông tin cuộc bầu cử
                var cuocBauCu = await _context.CuocBauCus
                    .Include(c => c.TaiKhoan)
                    .FirstOrDefaultAsync(c => c.Id == cuocBauCuId);

                if (cuocBauCu == null)
                {
                    _logger.LogError("Không tìm thấy cuộc bầu cử ID: {CuocBauCuId}", cuocBauCuId);
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy cuộc bầu cử";
                    return result;
                }

                if (cuocBauCu.TrangThaiBlockchain == 2)
                {
                    _logger.LogWarning("Cuộc bầu cử ID: {CuocBauCuId} đã được triển khai", cuocBauCuId);
                    result.Success = true;
                    result.BlockchainServerId = cuocBauCu.BlockchainServerId.GetValueOrDefault();
                    result.BlockchainAddress = cuocBauCu.BlockchainAddress;
                    result.Status = 2;
                    return result;
                }

                bool scwExists = await _blockchainService.CheckSCWExists(scwAddress);
                if (!scwExists)
                {
                    _logger.LogError("SCW không tồn tại tại địa chỉ: {SCWAddress}", scwAddress);
                    result.Success = false;
                    result.ErrorMessage = "SCW không tồn tại";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = "SCW không tồn tại";
                    await _context.SaveChangesAsync();
                    return result;
                }

                // Tìm ví SCW trong database
                var viSCW = await _context.ViBlockchain
                    .FirstOrDefaultAsync(v => v.DiaChiVi.ToLower() == scwAddress.ToLower() && v.TaiKhoanId == cuocBauCu.TaiKhoanId);
                if (viSCW == null)
                {
                    _logger.LogError("Không tìm thấy ví blockchain cho SCW {SCWAddress}", scwAddress);
                    result.Success = false;
                    result.ErrorMessage = "Không tìm thấy ví blockchain";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = "Không tìm thấy ví blockchain";
                    await _context.SaveChangesAsync();
                    return result;
                }

                // Lấy session key hiện tại
                // Sửa lỗi - Tạo đúng logger type cho SessionService
                var sessionServiceLogger = _logger.CreateScope<SessionService>();
                var sessionService = new SessionService(_context, sessionServiceLogger, _configuration);
                var sessionKey = await sessionService.GetValidSessionKeyEntity(cuocBauCu.TaiKhoanId ?? 0, viSCW.ViId);

                if (sessionKey == null)
                {
                    _logger.LogError("Không tìm thấy session key hợp lệ cho TaiKhoanId: {TaiKhoanId}, ViId: {ViId}", cuocBauCu.TaiKhoanId, viSCW.ViId);

                    try
                    {
                        // Thử tạo session key mới
                        await sessionService.CreateSessionKey(cuocBauCu.TaiKhoanId ?? 0, viSCW.ViId);
                        _logger.LogInformation("Đã tạo session key mới cho TaiKhoanId: {TaiKhoanId}, ViId: {ViId}", cuocBauCu.TaiKhoanId, viSCW.ViId);
                        sessionKey = await sessionService.GetValidSessionKeyEntity(cuocBauCu.TaiKhoanId ?? 0, viSCW.ViId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi tạo session key mới");
                        result.Success = false;
                        result.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        cuocBauCu.TrangThaiBlockchain = 3;
                        cuocBauCu.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        await _context.SaveChangesAsync();
                        return result;
                    }

                    if (sessionKey == null)
                    {
                        result.Success = false;
                        result.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        cuocBauCu.TrangThaiBlockchain = 3;
                        cuocBauCu.ErrorMessage = "Không tìm thấy hoặc không thể tạo session key";
                        await _context.SaveChangesAsync();
                        return result;
                    }
                }

                // Kiểm tra số dư và allowance
                try
                {
                    // Kiểm tra token balance
                    var hluTokenContract = _web3.Eth.GetContract(ContractABIs.HoLiHuToken, _hluTokenAddress);
                    var hluBalance = await hluTokenContract.GetFunction("balanceOf").CallAsync<BigInteger>(scwAddress);
                    var minRequiredBalance = Web3.Convert.ToWei(4m);

                    _logger.LogInformation("Số dư HLU của SCW {SCWAddress}: {Balance} wei",
                        scwAddress, hluBalance);

                    if (hluBalance < minRequiredBalance)
                    {
                        result.Success = false;
                        result.ErrorMessage = $"SCW không đủ HLU. Cần tối thiểu 4 HLU, hiện có {Web3.Convert.FromWei(hluBalance)} HLU";
                        cuocBauCu.TrangThaiBlockchain = 3;
                        cuocBauCu.ErrorMessage = result.ErrorMessage;
                        await _context.SaveChangesAsync();
                        return result;
                    }

                    // Kiểm tra allowance cho Factory
                    var allowanceForFactory = await hluTokenContract.GetFunction("allowance")
                        .CallAsync<BigInteger>(scwAddress, _factoryAddress);
                    var minFactoryAllowance = Web3.Convert.ToWei(4m);

                    _logger.LogInformation("Allowance cho Factory: {Allowance} wei", allowanceForFactory);

                    if (allowanceForFactory < minFactoryAllowance)
                    {
                        result.Success = false;
                        result.ErrorMessage = $"Chưa phê duyệt đủ HLU cho Factory. Cần tối thiểu 4 HLU";
                        cuocBauCu.TrangThaiBlockchain = 3;
                        cuocBauCu.ErrorMessage = result.ErrorMessage;
                        await _context.SaveChangesAsync();
                        return result;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi kiểm tra số dư và allowance");
                    // Tiếp tục xử lý, không return
                }

                // Tạo transaction hash hợp lệ cho Ethereum
                string transactionHash = GenerateValidTransactionHash();

                // Tạo và lưu giao dịch BlockchainTransaction
                var transaction = new BlockchainTransaction
                {
                    TransactionHash = transactionHash,
                    LoaiGiaoDich = "DEPLOY_SERVER",
                    TrangThai = 0, // Pending
                    NgayTao = DateTime.UtcNow,
                    DoiTuongId = cuocBauCuId,
                    LoaiDoiTuong = "CuocBauCu",
                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        SCWAddress = scwAddress,
                        TenCuocBauCu = cuocBauCu.TenCuocBauCu,
                        ThoiGianKeoDai = (long)(cuocBauCu.NgayKetThuc - cuocBauCu.NgayBatDau).TotalSeconds,
                        MoTa = cuocBauCu.MoTa ?? "Không có mô tả"
                    })
                };

                _context.BlockchainTransactions.Add(transaction);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Tạo giao dịch với transaction hash tạm thời: {TxHash}", transactionHash);

                // Tính toán thời gian kéo dài theo giây
                long thoiGianKeoDai;
                try
                {
                    TimeSpan duration = cuocBauCu.NgayKetThuc - cuocBauCu.NgayBatDau;
                    thoiGianKeoDai = (long)duration.TotalSeconds;

                    // Kiểm tra tính hợp lệ
                    if (thoiGianKeoDai <= 0)
                    {
                        _logger.LogWarning("Thời gian kéo dài không hợp lệ: {Duration} giây. Sử dụng giá trị mặc định 7 ngày.", thoiGianKeoDai);
                        thoiGianKeoDai = 7 * 24 * 60 * 60; // 7 ngày nếu thời gian không hợp lệ
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tính thời gian kéo dài cho cuộc bầu cử ID {CuocBauCuId}. Sử dụng giá trị mặc định.", cuocBauCuId);
                    thoiGianKeoDai = 7 * 24 * 60 * 60; // 7 ngày nếu tính toán lỗi
                }

                // Chuẩn bị tham số cho gọi Factory contract
                var tenCuocBauCu = cuocBauCu.TenCuocBauCu;
                var moTa = cuocBauCu.MoTa ?? "Không có mô tả";

                // Chuẩn bị callData cho việc triển khai Server
                string callData;
                try
                {
                    // Sử dụng phương thức để tạo callData đáng tin cậy
                    callData = await CreateCallDataForElection(scwAddress, tenCuocBauCu, thoiGianKeoDai, moTa);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tạo callData cho cuộc bầu cử ID {CuocBauCuId}", cuocBauCuId);

                    // Cập nhật trạng thái lỗi
                    result.Success = false;
                    result.ErrorMessage = $"Lỗi khi tạo callData: {ex.Message}";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = result.ErrorMessage;
                    transaction.TrangThai = 2; // Thất bại
                    await _context.SaveChangesAsync();

                    return result;
                }

                // Lấy EntryPoint contract
                var entryPointAddress = _configuration["BlockchainSettings:ContractAddresses:EntryPoint"];
                var entryPointContract = _web3.Eth.GetContract(ContractABIs.EntryPoint, entryPointAddress);

                // Lấy nonce hiện tại
                var nonce = await entryPointContract.GetFunction("getNonce").CallAsync<BigInteger>(scwAddress);

                // Tạo UserOperation với tham số từ script test thành công
                var userOp = new UserOperation
                {
                    Sender = scwAddress,
                    Nonce = nonce,
                    InitCode = "0x",
                    CallData = callData,
                    CallGasLimit = FIXED_CALL_GAS_LIMIT, // Giá trị cố định từ script test thành công
                    VerificationGasLimit = FIXED_VERIFICATION_GAS_LIMIT, // Giá trị cố định từ script test thành công
                    PreVerificationGas = FIXED_PRE_VERIFICATION_GAS, // Giá trị cố định từ script test thành công
                    MaxFeePerGas = Web3.Convert.ToWei(5, Nethereum.Util.UnitConversion.EthUnit.Gwei),
                    MaxPriorityFeePerGas = Web3.Convert.ToWei(2, Nethereum.Util.UnitConversion.EthUnit.Gwei),
                    PaymasterAndData = _paymasterAddress, // Chỉ địa chỉ paymaster, không có dữ liệu bổ sung
                    Signature = "0x"
                };

                // Ký UserOperation bằng session key
                _logger.LogInformation("Ký UserOperation bằng session key");
                var userOpHash = await entryPointContract.GetFunction("layHashThaoTac").CallAsync<string>(userOp);
                var signingKey = new Nethereum.Signer.EthECKey(sessionKey.Khoa);
                var ecdsaSignature = signingKey.Sign(Nethereum.Util.Sha3Keccack.Current.CalculateHash(Encoding.UTF8.GetBytes(userOpHash)));
                string signature = "0x" +
                                  BitConverter.ToString(ecdsaSignature.R).Replace("-", "").ToLowerInvariant() +
                                  BitConverter.ToString(ecdsaSignature.S).Replace("-", "").ToLowerInvariant() +
                                  (ecdsaSignature.V[0] < 27 ? (ecdsaSignature.V[0] + 27).ToString("x2") : ecdsaSignature.V[0].ToString("x2"));
                userOp.Signature = signature;

                _logger.LogInformation("Đã ký UserOperation, userOpHash: {UserOpHash}", userOpHash);

                // Gửi UserOperation đến bundler
                _logger.LogInformation("Gửi UserOperation đến bundler");

                // Thay đổi: Sử dụng IServiceProvider để tạo BundlerService
                var bundlerServiceLogger = _logger.CreateScope<BundlerService>();
                var bundlerService = new BundlerService(
                    _configuration,
                    bundlerServiceLogger,
                    _blockchainService,
                    _serviceProvider); // Truyền IServiceProvider thay vì IDbContextFactory

                // Thêm userOpHash vào userOp
                userOp.UserOpHash = userOpHash;

                var status = await bundlerService.SendUserOperation(userOp);
                _logger.LogInformation("Kết quả gửi UserOperation: {Status}", status);

                // Cập nhật transaction hash nếu có
                if (status.StartsWith("bundling") || status.StartsWith("pending"))
                {
                    // Cập nhật với hash thực tế từ UserOperation
                    transaction.TransactionHash = userOpHash;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Cập nhật transaction hash từ userOpHash: {Hash}", userOpHash);

                    // Cập nhật thông tin cuộc bầu cử
                    cuocBauCu.BlockchainAddress = scwAddress;
                    await _context.SaveChangesAsync();

                    result.Success = true;
                    result.TransactionHash = userOpHash;
                    result.BlockchainAddress = scwAddress;
                    result.Status = 1;

                    _logger.LogInformation("Triển khai thành công, đang chờ xác nhận. UserOpHash: {UserOpHash}", userOpHash);
                }
                else
                {
                    _logger.LogError("Lỗi khi gửi UserOperation: {Status}", status);
                    result.Success = false;
                    result.ErrorMessage = $"Lỗi khi gửi UserOperation: {status}";
                    cuocBauCu.TrangThaiBlockchain = 3;
                    cuocBauCu.ErrorMessage = result.ErrorMessage;
                    transaction.TrangThai = 2; // Thất bại
                    await _context.SaveChangesAsync();
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi triển khai server cho cuộc bầu cử: {CuocBauCuId}", cuocBauCuId);
                result.Success = false;
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Lấy thông tin ServerId từ contract trên blockchain
        /// </summary>
        /// <param name="contractAddress">Địa chỉ contract của cuộc bầu cử</param>
        /// <returns>Thông tin blockchain server</returns>
        public async Task<BlockchainServerInfo> GetServerInfoFromBlockchain(string contractAddress)
        {
            if (string.IsNullOrEmpty(contractAddress))
            {
                _logger.LogWarning("Địa chỉ contract rỗng");
                return null;
            }

            try
            {
                _logger.LogInformation("Tìm ServerId cho contract address: {ContractAddress}", contractAddress);

                // Lấy địa chỉ factory từ cấu hình
                string factoryAddress = _configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
                if (string.IsNullOrEmpty(factoryAddress))
                {
                    _logger.LogError("Không tìm thấy địa chỉ Factory trong cấu hình");
                    return null;
                }

                var web3 = new Web3(_rpcUrl);

                // Tạo contract instance cho Factory
                var factoryContract = web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, factoryAddress);

                // Lấy ID hiện tại (là giá trị lớn nhất có thể)
                var idCuocBauCuTiepTheoFunction = factoryContract.GetFunction("idCuocBauCuTiepTheo");
                var maxId = await idCuocBauCuTiepTheoFunction.CallAsync<BigInteger>();

                // Duyệt qua tất cả các ID để tìm ID phù hợp với địa chỉ contract
                var layThongTinServerFunction = factoryContract.GetFunction("layThongTinServer");

                _logger.LogInformation("Bắt đầu tìm kiếm trong {Count} server IDs", maxId);

                // Chuyển đổi địa chỉ contract sang chữ thường để so sánh
                contractAddress = contractAddress.ToLowerInvariant();

                // Tìm kiếm từ ID mới nhất về ID cũ nhất (hiệu quả hơn)
                for (int id = (int)maxId - 1; id >= 1; id--)
                {
                    try
                    {
                        var serverInfo = await layThongTinServerFunction.CallDeserializingToObjectAsync<ServerInfoDTO>(new BigInteger(id));

                        // So sánh địa chỉ, không phân biệt chữ hoa/thường
                        if (serverInfo != null &&
                            !string.IsNullOrEmpty(serverInfo.QuanLyCuocBauCu) &&
                            serverInfo.QuanLyCuocBauCu.ToLowerInvariant() == contractAddress)
                        {
                            _logger.LogInformation("Tìm thấy server ID {ServerId} cho địa chỉ {Address}", id, contractAddress);

                            return new BlockchainServerInfo
                            {
                                ServerId = id,
                                Address = contractAddress
                            };
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug(ex, "Lỗi khi kiểm tra server ID {ID}: {Error}", id, ex.Message);
                        // Bỏ qua lỗi và tiếp tục tìm kiếm
                        continue;
                    }
                }

                _logger.LogWarning("Không tìm thấy server ID nào cho địa chỉ {Address}", contractAddress);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy thông tin từ blockchain: {Error}", ex.Message);
                return null;
            }
        }
        public async Task<int> SyncServerIdsByElectionName(string creatorAddress, bool overwriteExisting = false)
        {
            if (string.IsNullOrEmpty(creatorAddress))
            {
                _logger.LogWarning("Địa chỉ người tạo rỗng");
                return 0;
            }

            try
            {
                _logger.LogInformation("Đồng bộ cuộc bầu cử theo tên cho người dùng: {CreatorAddress}", creatorAddress);

                // Lấy địa chỉ factory từ cấu hình
                string factoryAddress = _configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
                if (string.IsNullOrEmpty(factoryAddress))
                {
                    _logger.LogError("Không tìm thấy địa chỉ Factory trong cấu hình");
                    return 0;
                }

                var web3 = new Web3(_rpcUrl);
                var factoryContract = web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, factoryAddress);

                // Lấy tổng số server
                var idCuocBauCuTiepTheoFunction = factoryContract.GetFunction("idCuocBauCuTiepTheo");
                var maxId = await idCuocBauCuTiepTheoFunction.CallAsync<BigInteger>();

                _logger.LogInformation("Tổng số cuộc bầu cử: {Count}", maxId);

                if (maxId <= 0)
                {
                    return 0;
                }

                var syncCount = 0;
                var layThongTinServerFunction = factoryContract.GetFunction("layThongTinServer");

                // Lưu lại ID của các cuộc bầu cử SQL đã cập nhật để tránh cập nhật nhiều lần
                var updatedSqlIds = new HashSet<int>();

                // Duyệt qua từng ID từ cao xuống thấp (cuộc bầu cử mới nhất trước)
                for (int id = (int)maxId - 1; id >= 1; id--)
                {
                    try
                    {
                        // Sử dụng eth_call trực tiếp để lấy dữ liệu thô 
                        string data = layThongTinServerFunction.GetData(id);
                        var callInput = new Nethereum.RPC.Eth.DTOs.CallInput(data, factoryAddress);
                        var rawData = await web3.Eth.Transactions.Call.SendRequestAsync(callInput);

                        if (string.IsNullOrEmpty(rawData))
                        {
                            _logger.LogWarning("Không có dữ liệu trả về cho ID {ID}", id);
                            continue;
                        }

                        // Kiểm tra độ dài tối thiểu
                        if (rawData.Length < 448)
                        {
                            _logger.LogWarning("Dữ liệu trả về quá ngắn cho ID {ID}: {Data}", id, rawData);
                            continue;
                        }

                        // Đọc địa chỉ contract và người tạo
                        string contractAddress = "0x" + rawData.Substring(2 + 24, 40).ToLower();
                        string nguoiTao = "0x" + rawData.Substring(2 + 64 * 6 + 24, 40).ToLower();

                        // Người tạo không khớp, bỏ qua ID này
                        if (!nguoiTao.Equals(creatorAddress, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        // Đọc tenCuocBauCu
                        try
                        {
                            int tenCuocBauCuOffset = Convert.ToInt32(rawData.Substring(2 + 64, 64), 16);
                            int tenCuocBauCuPos = 2 + tenCuocBauCuOffset * 2;
                            int tenCuocBauCuLength = Convert.ToInt32(rawData.Substring(tenCuocBauCuPos, 64), 16);

                            string tenCuocBauCu = "";
                            if (tenCuocBauCuLength > 0 && tenCuocBauCuPos + 64 + tenCuocBauCuLength * 2 <= rawData.Length)
                            {
                                byte[] tenBytes = new byte[tenCuocBauCuLength];
                                for (int i = 0; i < tenCuocBauCuLength; i++)
                                {
                                    tenBytes[i] = Convert.ToByte(rawData.Substring(tenCuocBauCuPos + 64 + i * 2, 2), 16);
                                }
                                tenCuocBauCu = System.Text.Encoding.UTF8.GetString(tenBytes);
                            }

                            if (string.IsNullOrEmpty(tenCuocBauCu))
                            {
                                _logger.LogWarning("Không đọc được tên cuộc bầu cử cho ID {ID}", id);
                                continue;
                            }

                            _logger.LogInformation("Tìm thấy cuộc bầu cử ID {Id} của người dùng {CreatorAddress}, tên: {Name}",
                                id, creatorAddress, tenCuocBauCu);

                            // Tách phần tên cơ bản
                            string baseName = ExtractBaseName(tenCuocBauCu);

                            // Tìm trong database SQL theo tên
                            using (var scope = _serviceProvider.CreateScope())
                            {
                                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                                CuocBauCu cuocBauCu = null;

                                // Tìm trước theo tên đầy đủ
                                cuocBauCu = await dbContext.CuocBauCus
                                    .FirstOrDefaultAsync(c => c.TenCuocBauCu == tenCuocBauCu);

                                // Nếu không tìm thấy theo tên đầy đủ, thử tìm theo tên cơ bản
                                if (cuocBauCu == null && baseName != tenCuocBauCu)
                                {
                                    cuocBauCu = await dbContext.CuocBauCus
                                        .FirstOrDefaultAsync(c => c.TenCuocBauCu == baseName);
                                }

                                // Nếu đã thử hết mà vẫn không tìm thấy, thử tìm theo địa chỉ blockchain
                                if (cuocBauCu == null && !string.IsNullOrEmpty(contractAddress))
                                {
                                    cuocBauCu = await dbContext.CuocBauCus
                                        .FirstOrDefaultAsync(c => c.BlockchainAddress != null &&
                                                             c.BlockchainAddress.ToLower() == contractAddress);
                                }

                                // Nếu tìm thấy, kiểm tra xem có nên cập nhật không
                                if (cuocBauCu != null)
                                {
                                    // Kiểm tra xem đã cập nhật cuộc bầu cử này rồi hay chưa
                                    if (updatedSqlIds.Contains(cuocBauCu.Id))
                                    {
                                        _logger.LogInformation("Bỏ qua cuộc bầu cử SQL ID {Id}, đã cập nhật trong phiên này",
                                            cuocBauCu.Id);
                                        continue;
                                    }

                                    // Kiểm tra xem đã có ServerID và có cần ghi đè không
                                    if (cuocBauCu.BlockchainServerId.HasValue &&
                                        cuocBauCu.BlockchainServerId.Value > 0 &&
                                        !overwriteExisting)
                                    {
                                        _logger.LogInformation("Bỏ qua cuộc bầu cử SQL ID {Id}, tên {Ten}. Đã có ServerId = {ServerId}",
                                            cuocBauCu.Id, cuocBauCu.TenCuocBauCu, cuocBauCu.BlockchainServerId.Value);
                                        continue;
                                    }

                                    _logger.LogInformation("Tìm thấy cuộc bầu cử SQL ID {Id}, tên {Ten}. Cập nhật ServerId = {ServerId}",
                                        cuocBauCu.Id, cuocBauCu.TenCuocBauCu, id);

                                    cuocBauCu.BlockchainServerId = id;

                                    // Nếu địa chỉ blockchain trống, cập nhật luôn
                                    if (string.IsNullOrEmpty(cuocBauCu.BlockchainAddress))
                                    {
                                        cuocBauCu.BlockchainAddress = contractAddress;
                                    }

                                    await dbContext.SaveChangesAsync();
                                    syncCount++;

                                    // Thêm vào danh sách các ID đã cập nhật
                                    updatedSqlIds.Add(cuocBauCu.Id);
                                }
                                else
                                {
                                    // Thử tìm kiếm mở rộng với các biến thể khác nhau của tên
                                    bool found = false;

                                    // Tìm kiếm theo như tên gốc có chứa baseName
                                    if (!found && !string.IsNullOrEmpty(baseName))
                                    {
                                        var possibleMatches = await dbContext.CuocBauCus
                                            .Where(c => c.TenCuocBauCu.Contains(baseName))
                                            .ToListAsync();

                                        if (possibleMatches.Any())
                                        {
                                            // Lấy cuộc bầu cử đầu tiên tìm thấy
                                            cuocBauCu = possibleMatches.First();

                                            _logger.LogInformation("Tìm thấy cuộc bầu cử SQL mở rộng ID {Id}, tên {Ten}. Cập nhật ServerId = {ServerId}",
                                                cuocBauCu.Id, cuocBauCu.TenCuocBauCu, id);

                                            // Kiểm tra xem đã cập nhật ID này chưa
                                            if (!updatedSqlIds.Contains(cuocBauCu.Id))
                                            {
                                                cuocBauCu.BlockchainServerId = id;

                                                // Nếu địa chỉ blockchain trống, cập nhật luôn
                                                if (string.IsNullOrEmpty(cuocBauCu.BlockchainAddress))
                                                {
                                                    cuocBauCu.BlockchainAddress = contractAddress;
                                                }

                                                await dbContext.SaveChangesAsync();
                                                syncCount++;

                                                // Thêm vào danh sách các ID đã cập nhật
                                                updatedSqlIds.Add(cuocBauCu.Id);
                                                found = true;
                                            }
                                            else
                                            {
                                                _logger.LogInformation("Bỏ qua cuộc bầu cử SQL ID {Id}, đã cập nhật trong phiên này",
                                                    cuocBauCu.Id);
                                            }
                                        }
                                    }

                                    if (!found)
                                    {
                                        _logger.LogWarning("Không tìm thấy cuộc bầu cử SQL với tên {BaseName} hoặc {FullName}",
                                            baseName, tenCuocBauCu);
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Lỗi khi xử lý tên cuộc bầu cử cho ID {ID}: {Error}", id, ex.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi xử lý thông tin cho ID {ID}: {Error}", id, ex.Message);
                        // Tiếp tục với ID tiếp theo
                    }
                }

                _logger.LogInformation("Đã đồng bộ thành công {Count} cuộc bầu cử", syncCount);
                return syncCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đồng bộ cuộc bầu cử theo tên: {Error}", ex.Message);
                return 0;
            }
        }

        /// <summary>
        /// Trích xuất tên cơ bản từ tên đầy đủ bằng cách xác định phần có timestamp
        /// </summary>
        private string ExtractBaseName(string fullName)
        {
            // Nếu không có dấu gạch ngang, trả về nguyên tên
            if (!fullName.Contains("-"))
                return fullName;

            // Tách các phần theo dấu "-"
            var parts = fullName.Split('-');

            // Đi từ cuối lên để tìm mẫu timestamp
            for (int i = parts.Length - 2; i >= 0; i--)
            {
                // Kiểm tra nếu phần tiếp theo là số unixtime (13 chữ số)
                if (i + 1 < parts.Length &&
                    long.TryParse(parts[i + 1], out long timestamp) &&
                    parts[i + 1].Length >= 10 && parts[i + 1].Length <= 13)
                {
                    // Nối các phần trước timestamp lại với nhau
                    return string.Join("-", parts.Take(i + 1));
                }
            }

            // Nếu không tìm thấy phần timestamp, trả lại tên đầy đủ
            return fullName;
        }





        public async Task<bool> UpdateElectionImage(int cuocBauCuId, IFormFile imageFile)
        {
            try
            {
                var cuocBauCu = await _context.CuocBauCus.FindAsync(cuocBauCuId);
                if (cuocBauCu == null)
                {
                    _logger.LogError("Không tìm thấy cuộc bầu cử ID: {CuocBauCuId}", cuocBauCuId);
                    return false;
                }

                if (imageFile == null || imageFile.Length == 0)
                {
                    _logger.LogError("File ảnh không hợp lệ");
                    return false;
                }

                string fileName = $"election_{cuocBauCuId}_{Guid.NewGuid().ToString()}{Path.GetExtension(imageFile.FileName)}";
                using (var stream = imageFile.OpenReadStream())
                {
                    string imageUrl = await _azureBlobService.UploadFileAsync(stream, fileName, imageFile.ContentType);
                    cuocBauCu.AnhCuocBauCu = imageUrl;
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("Cập nhật ảnh thành công cho cuộc bầu cử ID: {CuocBauCuId}", cuocBauCuId);
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật ảnh cho cuộc bầu cử: {Error}", ex.Message);
                return false;
            }
        }
    }
}

// Lớp hỗ trợ để deserialize kết quả từ hàm taoUserOpTrienKhaiServer
public class UserOpRawData
{
    public string Sender { get; set; }
    public string Nonce { get; set; }
    public string CallData { get; set; }
}

/// <summary>
/// Extension method cho ILogger để tạo ra logger cho loại khác
/// </summary>
public static class LoggerExtensions
{
    public static ILogger<T> CreateScope<T>(this ILogger logger)
    {
        // Giả lập ILogger<T> bằng cách bao bọc ILogger gốc
        return new ScopedLogger<T>(logger);
    }
}

/// <summary>
/// Logger bọc để giả lập ILogger<T>
/// </summary>
public class ScopedLogger<T> : ILogger<T>
{
    private readonly ILogger _logger;

    public ScopedLogger(ILogger logger)
    {
        _logger = logger;
    }

    public IDisposable BeginScope<TState>(TState state) => _logger.BeginScope(state);
    public bool IsEnabled(LogLevel logLevel) => _logger.IsEnabled(logLevel);
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
    {
        _logger.Log(logLevel, eventId, state, exception, formatter);
    }
}

/// <summary>
/// Kết quả chuẩn bị triển khai blockchain
/// </summary>
public class BlockchainDeployPrepareResult
{
    public bool Success { get; set; }
    public string ErrorMessage { get; set; }
    public long BlockchainServerId { get; set; }
    public string BlockchainAddress { get; set; }
    public int TaiKhoanId { get; set; }
    public int ViId { get; set; }
    public string FactoryAddress { get; set; }
    public string PaymasterAddress { get; set; }
    public string TenCuocBauCu { get; set; }
    public long ThoiGianKeoDai { get; set; }
    public string MoTa { get; set; }
    public ApprovalCallData ApprovalCallData { get; set; }

    // Thêm các tham số gas cố định
    public string CallGasLimit { get; set; }
    public string VerificationGasLimit { get; set; }
    public string PreVerificationGas { get; set; }
}

/// <summary>
/// Dữ liệu phê duyệt token
/// </summary>
public class ApprovalCallData
{
    public string FactoryApprovalCallData { get; set; }
    public string PaymasterApprovalCallData { get; set; }
}

/// <summary>
/// Kết quả triển khai blockchain
/// </summary>
public class BlockchainDeployResult
{
    public bool Success { get; set; }
    public string ErrorMessage { get; set; }
    public long BlockchainServerId { get; set; }
    public string BlockchainAddress { get; set; }
    public string TransactionHash { get; set; }
    public int Status { get; set; }
}

/// <summary>
/// DTO để deserialize kết quả từ hàm layThongTinServer
/// </summary>
//public class ServerInfoDTO
//{
//    public string QuanLyCuocBauCu { get; set; }
//    public string TenCuocBauCu { get; set; }
//    public string MoTa { get; set; }
//    public byte TrangThai { get; set; }
//    public ulong SoLuongBaoCao { get; set; }
//    public ulong SoLuongViPhamXacNhan { get; set; }
//    public string NguoiTao { get; set; }
//}

[FunctionOutput]
public class ServerInfoDTO
{
    [Parameter("address", "quanLyCuocBauCu", 0)]
    public string QuanLyCuocBauCu { get; set; }

    [Parameter("string", "tenCuocBauCu", 1)]
    public string TenCuocBauCu { get; set; }

    [Parameter("string", "moTa", 2)]
    public string MoTa { get; set; }

    [Parameter("uint8", "trangThai", 3)]
    public byte TrangThai { get; set; }

    [Parameter("uint64", "soLuongBaoCao", 4)]
    public ulong SoLuongBaoCao { get; set; }

    [Parameter("uint64", "soLuongViPhamXacNhan", 5)]
    public ulong SoLuongViPhamXacNhan { get; set; }

    [Parameter("address", "nguoiTao", 6)]
    public string NguoiTao { get; set; }
}

/// <summary>
/// Class chứa thông tin blockchain server
/// </summary>
public class BlockchainServerInfo
{
    public int ServerId { get; set; }
    public string Address { get; set; }
}

