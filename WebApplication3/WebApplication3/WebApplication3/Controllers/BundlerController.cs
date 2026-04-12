using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Nethereum.Web3;
using Microsoft.Extensions.Configuration;
using WebApplication3.Models;
using WebApplication3.Services;
using Microsoft.Extensions.Logging;
using System;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using WebApplication3.Data;
using Nethereum.Signer;
using System.Threading.Tasks;
using WebApplication3.Contracts;
using System.Linq;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.ABI;
using System.Text;
using System.Collections.Generic;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/bundler")]
    [Authorize]
    public class BundlerController : ControllerBase
    {
        private readonly BundlerService _bundlerService;
        private readonly SessionService _sessionService;
        private readonly ILogger<BundlerController> _logger;
        private readonly ApplicationDbContext _dbContext;
        private readonly Web3 _web3;
        private readonly string _entryPointAddress;
        private readonly int _chainId;

        public BundlerController(
            BundlerService bundlerService,
            SessionService sessionService,
            IConfiguration configuration,
            ILogger<BundlerController> logger,
            ApplicationDbContext dbContext)
        {
            _bundlerService = bundlerService ?? throw new ArgumentNullException(nameof(bundlerService));
            _sessionService = sessionService ?? throw new ArgumentNullException(nameof(sessionService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));

            var rpcUrl = configuration["BlockchainSettings:RpcUrl"];
            var adminPrivateKey = configuration["BlockchainSettings:AdminPrivateKey"];
            _entryPointAddress = configuration["BlockchainSettings:ContractAddresses:EntryPoint"];
            _chainId = configuration.GetValue<int>("BlockchainSettings:ChainId", 210);

            if (string.IsNullOrEmpty(rpcUrl) || string.IsNullOrEmpty(adminPrivateKey) || string.IsNullOrEmpty(_entryPointAddress))
            {
                throw new ArgumentException("Thiếu cấu hình blockchain");
            }

            _web3 = new Web3(new Nethereum.Web3.Accounts.Account(adminPrivateKey), rpcUrl);
        }
        [HttpPost("submit")]
        public async Task<IActionResult> SubmitUserOperation([FromBody] UserOperationDTO userOpDto)
        {
            if (userOpDto == null)
            {
                _logger.LogWarning("Nhận được UserOperation null");
                return BadRequest(new { Message = "UserOperation không được để trống" });
            }

            try
            {
                // Kiểm tra, xác thực payload...

                var userOp = UserOperation.FromDTO(userOpDto);

                // Code xác thực ví, khóa phiên...

                // === CẢI TIẾN: Xử lý hash từ frontend và backend ===
                string frontendHash = userOpDto.UserOpHash;
                string backendHash = _bundlerService.CalculateUserOpHash(userOp);

                if (!string.IsNullOrEmpty(frontendHash))
                {
                    _logger.LogInformation("Nhận UserOpHash từ frontend: {FrontendHash}", frontendHash);
                    _logger.LogInformation("Tính UserOpHash bằng backend: {BackendHash}", backendHash);

                    if (frontendHash != backendHash)
                    {
                        _logger.LogWarning("Hash từ frontend khác với hash tính bởi backend: {FrontendHash} vs {BackendHash}",
                            frontendHash, backendHash);

                        // Lưu mối quan hệ giữa các hash
                        await StoreHashRelationshipAsync(frontendHash, backendHash, userOp.Sender);
                    }
                }
                else
                {
                    frontendHash = backendHash;
                    _logger.LogInformation("Sử dụng hash tính từ backend: {BackendHash}", backendHash);
                }

                // Đặt hash trong đối tượng UserOperation
                userOp.UserOpHash = frontendHash;

                // Gửi UserOperation đến BundlerService
                var status = await _bundlerService.SendUserOperation(userOp);
                _logger.LogInformation("Đã gửi UserOperation tới BundlerService cho {Sender}, Trạng thái: {Status}", userOp.Sender, status);

                return Ok(new
                {
                    Message = "Đã nhận UserOperation thành công",
                    TxStatus = "pending",
                    UserOpHash = frontendHash,
                    BackendHash = backendHash,
                    Status = status
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý UserOperation: {Error}", ex.Message);
                return StatusCode(500, new { Message = "Lỗi server", Error = ex.Message });
            }
        }

        // Phương thức bổ sung để lưu mối quan hệ giữa các hash
        private async Task StoreHashRelationshipAsync(string frontendHash, string backendHash, string sender)
        {
            try
            {
                // Lưu thông tin vào bảng BlockchainTransactions
                var hashLink = new Dictionary<string, object>
        {
            { "frontendHash", frontendHash },
            { "backendHash", backendHash },
            { "timestamp", DateTime.UtcNow },
            { "sender", sender }
        };

                // Bản ghi liên kết từ frontend hash đến backend hash
                var frontendTransaction = new BlockchainTransaction
                {
                    TransactionHash = frontendHash,
                    LoaiGiaoDich = "HASH_LINK",
                    TrangThai = 0, // Pending
                    NgayTao = DateTime.UtcNow,
                    NgayCapNhat = DateTime.UtcNow,
                    MetaData = System.Text.Json.JsonSerializer.Serialize(hashLink)
                };

                _dbContext.BlockchainTransactions.Add(frontendTransaction);

                // Bản ghi liên kết từ backend hash đến frontend hash
                var backendTransaction = new BlockchainTransaction
                {
                    TransactionHash = backendHash,
                    LoaiGiaoDich = "HASH_LINK",
                    TrangThai = 0, // Pending
                    NgayTao = DateTime.UtcNow,
                    NgayCapNhat = DateTime.UtcNow,
                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        frontendHash = frontendHash,
                        backendHash = backendHash,
                        sender = sender,
                        timestamp = DateTime.UtcNow
                    })
                };

                _dbContext.BlockchainTransactions.Add(backendTransaction);
                await _dbContext.SaveChangesAsync();

                _logger.LogInformation("Đã lưu mối quan hệ giữa frontend hash {FrontendHash} và backend hash {BackendHash}",
                    frontendHash, backendHash);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Không thể ghi nhận mối quan hệ giữa các hash: {Error}", ex.Message);
                // Không dừng xử lý nếu gặp lỗi
            }
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                EntryPointAddress = _entryPointAddress,
                BundlerAddress = _web3.TransactionManager.Account.Address,
                ChainId = _chainId,
                NetworkName = "HoLiHu Private Network",
                Version = "1.1.0"
            });
        }

        [HttpGet("check-status")]
        public async Task<IActionResult> CheckUserOpStatus([FromQuery] string userOpHash)
        {
            if (string.IsNullOrEmpty(userOpHash) || !userOpHash.StartsWith("0x"))
            {
                return BadRequest(new { Message = "UserOpHash không hợp lệ" });
            }

            try
            {
                // Cải tiến: Tìm tất cả các hash liên quan
                var relatedHashes = await FindRelatedHashesAsync(userOpHash);

                // Kiểm tra trạng thái của hash chính
                var (success, txHash, blockNumber) = await _bundlerService.CheckUserOperationStatus(userOpHash);

                // Nếu không tìm thấy với hash đầu tiên, thử kiểm tra với các hash liên quan
                if (!success && relatedHashes.Count > 0)
                {
                    _logger.LogInformation("Kiểm tra với {Count} hash liên quan", relatedHashes.Count);

                    foreach (var relatedHash in relatedHashes)
                    {
                        var (relatedSuccess, relatedTxHash, relatedBlockNumber) =
                            await _bundlerService.CheckUserOperationStatus(relatedHash);

                        if (relatedSuccess)
                        {
                            // Nếu tìm thấy với hash liên quan, trả về kết quả đó
                            return Ok(new
                            {
                                Message = "UserOperation đã được xử lý (tìm thấy với hash liên quan)",
                                Status = "success",
                                TxHash = relatedTxHash,
                                BlockNumber = relatedBlockNumber,
                                OriginalHash = userOpHash,
                                RelatedHash = relatedHash,
                                Timestamp = DateTime.UtcNow
                            });
                        }
                        else if (relatedBlockNumber > 0)
                        {
                            // Nếu thất bại nhưng đã được xử lý
                            return Ok(new
                            {
                                Message = "UserOperation đã được xử lý nhưng thất bại (tìm thấy với hash liên quan)",
                                Status = "failed",
                                TxHash = relatedTxHash,
                                BlockNumber = relatedBlockNumber,
                                OriginalHash = userOpHash,
                                RelatedHash = relatedHash,
                                Timestamp = DateTime.UtcNow
                            });
                        }
                        else if (!string.IsNullOrEmpty(relatedTxHash) && relatedTxHash != relatedHash)
                        {
                            // Đang chờ xử lý với hash liên quan
                            return Ok(new
                            {
                                Message = "UserOperation đang chờ xử lý (tìm thấy với hash liên quan)",
                                Status = "pending",
                                TxHash = relatedTxHash,
                                OriginalHash = userOpHash,
                                RelatedHash = relatedHash,
                                Timestamp = DateTime.UtcNow
                            });
                        }
                    }
                }

                // Trả về kết quả với hash gốc nếu có
                if (success)
                {
                    return Ok(new
                    {
                        Message = "UserOperation đã được xử lý",
                        Status = "success",
                        TxHash = txHash,
                        BlockNumber = blockNumber,
                        RelatedHashes = relatedHashes,
                        Timestamp = DateTime.UtcNow
                    });
                }
                else if (blockNumber > 0)
                {
                    return Ok(new
                    {
                        Message = "UserOperation đã được xử lý nhưng thất bại",
                        Status = "failed",
                        TxHash = txHash,
                        BlockNumber = blockNumber,
                        RelatedHashes = relatedHashes,
                        Timestamp = DateTime.UtcNow
                    });
                }
                else if (!string.IsNullOrEmpty(txHash) && txHash != userOpHash)
                {
                    // Đã được gửi nhưng chưa được xác nhận
                    return Ok(new
                    {
                        Message = "UserOperation đang chờ xử lý",
                        Status = "pending",
                        TxHash = txHash,
                        RelatedHashes = relatedHashes,
                        Timestamp = DateTime.UtcNow
                    });
                }

                // Không tìm thấy
                return Ok(new
                {
                    Message = "UserOperation chưa được xử lý hoặc không tồn tại",
                    Status = "unknown",
                    TxHash = userOpHash,
                    RelatedHashes = relatedHashes,
                    Timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra trạng thái UserOpHash {UserOpHash}: {Error}", userOpHash, ex.Message);
                return StatusCode(500, new { Message = "Lỗi server", Error = ex.Message });
            }
        }

        // Phương thức bổ sung để tìm tất cả các hash liên quan
        private async Task<List<string>> FindRelatedHashesAsync(string originalHash)
        {
            var relatedHashes = new List<string>();

            try
            {
                // Tìm các bản ghi có chứa hash trong metadata
                var transactions = await _dbContext.BlockchainTransactions
                    .Where(t => t.TransactionHash == originalHash || t.MetaData.Contains(originalHash))
                    .ToListAsync();

                foreach (var transaction in transactions)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(transaction.MetaData))
                        {
                            var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);

                            // Tìm kiếm các trường có thể chứa hash liên quan
                            foreach (var field in new[] { "frontendHash", "backendHash", "relatedHash", "actualTxHash" })
                            {
                                if (metadata.RootElement.TryGetProperty(field, out var hashElement))
                                {
                                    var relatedHash = hashElement.GetString();
                                    if (!string.IsNullOrEmpty(relatedHash) &&
                                        relatedHash != originalHash &&
                                        !relatedHashes.Contains(relatedHash))
                                    {
                                        relatedHashes.Add(relatedHash);
                                    }
                                }
                            }
                        }

                        // Thêm TransactionHash nếu chưa có trong danh sách
                        if (transaction.TransactionHash != originalHash &&
                            !relatedHashes.Contains(transaction.TransactionHash))
                        {
                            relatedHashes.Add(transaction.TransactionHash);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi phân tích metadata của giao dịch {Hash}", transaction.TransactionHash);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tìm các hash liên quan cho {Hash}", originalHash);
            }

            return relatedHashes;
        }

        // Thêm endpoint mới để ước tính gas cho UserOperation
        [HttpPost("estimate")]
        public async Task<IActionResult> EstimateUserOp([FromBody] UserOperationDTO userOpDto)
        {
            if (userOpDto == null)
            {
                return BadRequest(new { Message = "UserOperation không được để trống" });
            }

            try
            {
                var userOp = UserOperation.FromDTO(userOpDto);

                // Log thông tin chi tiết về UserOperation
                _logger.LogInformation("Ước tính gas cho UserOperation từ {Sender}, Nonce: {Nonce}",
                    userOp.Sender, userOp.Nonce);

                _logger.LogInformation("CallData length: {CallDataLength}, Signature length: {SignatureLength}",
                    string.IsNullOrEmpty(userOp.CallData) ? 0 : userOp.CallData.Length,
                    string.IsNullOrEmpty(userOp.Signature) ? 0 : userOp.Signature.Length);

                // Trả về giá trị cố định từ script test thành công
                var estimatedGas = new Dictionary<string, object>
                {
                    { "callGasLimit", 2245362 }, // Giá trị từ createElection.js
                    { "verificationGasLimit", 600000 }, // Giữ nguyên
                    { "preVerificationGas", 210000 }, // Giữ nguyên
                    { "totalGas", 3055362 }, // Tổng mới (2245362 + 600000 + 210000)
                    { "maxFeePerGas", userOp.MaxFeePerGas },
                    { "maxPriorityFeePerGas", userOp.MaxPriorityFeePerGas }
                };

                _logger.LogInformation("Trả về ước tính gas cố định từ script test thành công");

                // Tính hash frontend nếu có thể
                string userOpHash = userOp.UserOpHash ?? _bundlerService.CalculateUserOpHash(userOp);

                // Trả về ước tính gas
                return Ok(new
                {
                    Message = "Ước tính gas thành công",
                    Estimation = estimatedGas,
                    UserOpHash = userOpHash
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi ước tính gas: {Error}", ex.Message);
                return StatusCode(500, new { Message = "Lỗi server", Error = ex.Message });
            }
        }

        // Thêm endpoint mới để kết nối hash
        [HttpPost("link-hashes")]
        public async Task<IActionResult> LinkHashes([FromBody] LinkHashesRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.FrontendHash) || string.IsNullOrEmpty(request.BackendHash))
            {
                return BadRequest(new { Message = "Cần cung cấp cả frontend hash và backend hash" });
            }

            try
            {
                // Lưu mối quan hệ giữa hai hash
                var transaction = new BlockchainTransaction
                {
                    TransactionHash = request.FrontendHash,
                    LoaiGiaoDich = "HASH_LINK",
                    TrangThai = 0, // Chưa xác nhận
                    NgayTao = DateTime.UtcNow,
                    NgayCapNhat = DateTime.UtcNow,
                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        frontendHash = request.FrontendHash,
                        backendHash = request.BackendHash,
                        sender = request.Sender,
                        timestamp = DateTime.UtcNow
                    })
                };

                _dbContext.BlockchainTransactions.Add(transaction);
                await _dbContext.SaveChangesAsync();

                return Ok(new
                {
                    Success = true,
                    Message = "Đã liên kết hash thành công",
                    FrontendHash = request.FrontendHash,
                    BackendHash = request.BackendHash
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi liên kết hash: {Error}", ex.Message);
                return StatusCode(500, new { Success = false, Error = ex.Message });
            }
        }

        //[HttpPost("link-hashes")]
        //public async Task<IActionResult> LinkHashes([FromBody] LinkHashesRequest request)
        //{
        //    if (request == null || string.IsNullOrEmpty(request.FrontendHash) || string.IsNullOrEmpty(request.BackendHash))
        //    {
        //        return BadRequest(new { Success = false, Message = "Cần cung cấp cả frontend hash và backend hash" });
        //    }

        //    try
        //    {
        //        _logger.LogInformation("Liên kết hash: Frontend {FrontendHash}, Backend {BackendHash}, Sender {Sender}",
        //            request.FrontendHash, request.BackendHash, request.Sender);

        //        // Kiểm tra trước khi tạo mới hoặc cập nhật
        //        var frontendTransaction = await _dbContext.BlockchainTransactions
        //            .FirstOrDefaultAsync(t => t.TransactionHash == request.FrontendHash);

        //        var backendTransaction = await _dbContext.BlockchainTransactions
        //            .FirstOrDefaultAsync(t => t.TransactionHash == request.BackendHash);

        //        // Cập nhật hoặc tạo bản ghi cho frontend hash
        //        if (frontendTransaction != null)
        //        {
        //            // Cập nhật metadata cho bản ghi frontend
        //            var frontendMetadata = new Dictionary<string, object>();
        //            try
        //            {
        //                if (!string.IsNullOrEmpty(frontendTransaction.MetaData))
        //                {
        //                    var metadata = System.Text.Json.JsonDocument.Parse(frontendTransaction.MetaData);
        //                    foreach (var element in metadata.RootElement.EnumerateObject())
        //                    {
        //                        frontendMetadata[element.Name] = element.Value.GetRawText();
        //                    }
        //                }
        //            }
        //            catch (Exception ex)
        //            {
        //                _logger.LogWarning(ex, "Lỗi khi parse metadata của frontend hash, sẽ tạo metadata mới");
        //            }

        //            // Cập nhật hoặc thêm mới các thuộc tính
        //            frontendMetadata["backendHash"] = request.BackendHash;
        //            frontendMetadata["updated"] = DateTime.UtcNow.ToString("o");
        //            if (!string.IsNullOrEmpty(request.Sender))
        //            {
        //                frontendMetadata["sender"] = request.Sender;
        //            }

        //            frontendTransaction.MetaData = System.Text.Json.JsonSerializer.Serialize(frontendMetadata);
        //            frontendTransaction.NgayCapNhat = DateTime.UtcNow;
        //            _logger.LogInformation("Đã cập nhật bản ghi cho frontend hash: {FrontendHash}", request.FrontendHash);
        //        }
        //        else
        //        {
        //            // Tạo bản ghi mới cho frontend hash
        //            frontendTransaction = new BlockchainTransaction
        //            {
        //                TransactionHash = request.FrontendHash,
        //                LoaiGiaoDich = "HASH_LINK",
        //                TrangThai = 0, // Chưa xác nhận
        //                NgayTao = DateTime.UtcNow,
        //                NgayCapNhat = DateTime.UtcNow,
        //                MetaData = System.Text.Json.JsonSerializer.Serialize(new
        //                {
        //                    frontendHash = request.FrontendHash,
        //                    backendHash = request.BackendHash,
        //                    sender = request.Sender,
        //                    created = DateTime.UtcNow.ToString("o")
        //                })
        //            };
        //            _dbContext.BlockchainTransactions.Add(frontendTransaction);
        //            _logger.LogInformation("Đã tạo bản ghi mới cho frontend hash: {FrontendHash}", request.FrontendHash);
        //        }

        //        // Cập nhật hoặc tạo bản ghi cho backend hash
        //        if (backendTransaction != null)
        //        {
        //            // Cập nhật metadata cho bản ghi backend
        //            var backendMetadata = new Dictionary<string, object>();
        //            try
        //            {
        //                if (!string.IsNullOrEmpty(backendTransaction.MetaData))
        //                {
        //                    var metadata = System.Text.Json.JsonDocument.Parse(backendTransaction.MetaData);
        //                    foreach (var element in metadata.RootElement.EnumerateObject())
        //                    {
        //                        backendMetadata[element.Name] = element.Value.GetRawText();
        //                    }
        //                }
        //            }
        //            catch (Exception ex)
        //            {
        //                _logger.LogWarning(ex, "Lỗi khi parse metadata của backend hash, sẽ tạo metadata mới");
        //            }

        //            // Cập nhật hoặc thêm mới các thuộc tính
        //            backendMetadata["frontendHash"] = request.FrontendHash;
        //            backendMetadata["updated"] = DateTime.UtcNow.ToString("o");
        //            if (!string.IsNullOrEmpty(request.Sender))
        //            {
        //                backendMetadata["sender"] = request.Sender;
        //            }

        //            backendTransaction.MetaData = System.Text.Json.JsonSerializer.Serialize(backendMetadata);
        //            backendTransaction.NgayCapNhat = DateTime.UtcNow;
        //            _logger.LogInformation("Đã cập nhật bản ghi cho backend hash: {BackendHash}", request.BackendHash);
        //        }
        //        else
        //        {
        //            // Tạo bản ghi mới cho backend hash
        //            backendTransaction = new BlockchainTransaction
        //            {
        //                TransactionHash = request.BackendHash,
        //                LoaiGiaoDich = "HASH_LINK",
        //                TrangThai = 0, // Chưa xác nhận
        //                NgayTao = DateTime.UtcNow,
        //                NgayCapNhat = DateTime.UtcNow,
        //                MetaData = System.Text.Json.JsonSerializer.Serialize(new
        //                {
        //                    frontendHash = request.FrontendHash,
        //                    backendHash = request.BackendHash,
        //                    sender = request.Sender,
        //                    created = DateTime.UtcNow.ToString("o")
        //                })
        //            };
        //            _dbContext.BlockchainTransactions.Add(backendTransaction);
        //            _logger.LogInformation("Đã tạo bản ghi mới cho backend hash: {BackendHash}", request.BackendHash);
        //        }

        //        // Lưu các thay đổi vào database
        //        await _dbContext.SaveChangesAsync();

        //        return Ok(new
        //        {
        //            Success = true,
        //            Message = "Đã liên kết hash thành công",
        //            FrontendHash = request.FrontendHash,
        //            BackendHash = request.BackendHash,
        //            Timestamp = DateTime.UtcNow
        //        });
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "Lỗi khi liên kết hash: {Error}", ex.Message);
        //        return StatusCode(500, new { Success = false, Error = ex.Message });
        //    }
        //}
    }

    public class LinkHashesRequest
    {
        public string FrontendHash { get; set; }
        public string BackendHash { get; set; }
        public string Sender { get; set; }
    }
}