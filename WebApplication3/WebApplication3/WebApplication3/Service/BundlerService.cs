using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Web3;
using Nethereum.Hex.HexTypes;
using Nethereum.RPC.Eth.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WebApplication3.Models;
using WebApplication3.Contracts;
using Microsoft.AspNetCore.Mvc;
using System.Numerics;
using WebApplication3.Data;
using Microsoft.EntityFrameworkCore;
using System.Text;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Signer;
using Microsoft.Extensions.DependencyInjection;
using Nethereum.Contracts.TransactionHandlers;

namespace WebApplication3.Services
{
    public class BundlerService : ControllerBase, IDisposable
    {
        private readonly Web3 _web3;
        private readonly string _entryPointAddress;
        private readonly List<UserOperation> _queue = new();
        private readonly Dictionary<string, int> _retryCounts = new(); // Quản lý số lần thử lại theo Sender
        private readonly object _lock = new();
        private readonly ILogger<BundlerService> _logger;

        // Giảm thời gian bundling từ 30s xuống 5s
        private readonly Timer _bundlingTimer;
        private readonly TimeSpan _bundlingInterval = TimeSpan.FromSeconds(5);

        private readonly int _maxQueueSize = 20; // Tăng kích thước hàng đợi
        private readonly BlockchainService _blockchainService;
        private readonly string _adminPrivateKey;

        // Sử dụng IServiceProvider thay vì DbContextFactory
        private readonly IServiceProvider _serviceProvider;

        private bool _disposed = false;
        private const int MaxRetryCount = 3; // Giới hạn số lần thử lại

        // Lưu trữ giao dịch đã gửi để theo dõi
        private readonly Dictionary<string, string> _sentTransactions = new(); // UserOpHash -> TxHash
        private readonly Dictionary<string, DateTime> _sentTimestamps = new(); // UserOpHash -> Timestamp
        private readonly Dictionary<string, string> _hashRelationships = new(); // FrontendHash -> BackendHash

        // Thêm quản lý nonce tập trung
        private readonly Dictionary<string, BigInteger> _lastKnownNonce = new();
        private readonly SemaphoreSlim _nonceLock = new SemaphoreSlim(1, 1);

        // Thêm flag để kiểm soát giao dịch đã được xác nhận
        private readonly HashSet<string> _confirmedTransactions = new(); // TxHash đã được xác nhận

        // Giảm thời gian chờ timeout từ 1 giờ xuống 10 phút
        private readonly TimeSpan _transactionTimeout = TimeSpan.FromMinutes(10);

        public BundlerService(
            IConfiguration configuration,
            ILogger<BundlerService> logger,
            BlockchainService blockchainService,
            IServiceProvider serviceProvider)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _blockchainService = blockchainService ?? throw new ArgumentNullException(nameof(blockchainService));
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));

            var rpcUrl = configuration["BlockchainSettings:RpcUrl"];
            _adminPrivateKey = configuration["BlockchainSettings:AdminPrivateKey"];
            _entryPointAddress = configuration["BlockchainSettings:ContractAddresses:EntryPoint"];

            if (string.IsNullOrEmpty(rpcUrl))
            {
                _logger.LogError("Không tìm thấy RPC URL trong cấu hình");
                throw new ArgumentException("Missing RPC URL configuration");
            }

            if (string.IsNullOrEmpty(_adminPrivateKey))
            {
                _logger.LogError("Không tìm thấy Admin Private Key trong cấu hình");
                throw new ArgumentException("Missing Admin Private Key configuration");
            }

            if (string.IsNullOrEmpty(_entryPointAddress))
            {
                _logger.LogError("Không tìm thấy địa chỉ EntryPoint trong cấu hình");
                throw new ArgumentException("Missing EntryPoint address configuration");
            }

            _web3 = new Web3(new Nethereum.Web3.Accounts.Account(_adminPrivateKey), rpcUrl);

            // Khởi tạo timer cho bundling với khoảng thời gian ngắn hơn (5s)
            _bundlingTimer = new Timer(async _ => await BundleAndSendTimerCallback(), null, _bundlingInterval, _bundlingInterval);

            // Giảm interval kiểm tra từ 15s xuống 5s cho các giao dịch đang pending
            var transactionCheckInterval = TimeSpan.FromSeconds(5);
            new Timer(async _ => await CheckPendingTransactionsAsync(), null, transactionCheckInterval, transactionCheckInterval);

            _logger.LogInformation("BundlerService khởi tạo với EntryPoint: {EntryPoint}, RPC URL: {RpcUrl}", _entryPointAddress, rpcUrl);
        }

        // Phương thức lấy và tăng nonce tập trung
        private async Task<BigInteger> GetAndIncrementNonceAsync(string sender)
        {
            await _nonceLock.WaitAsync();
            try
            {
                BigInteger nonce;
                if (_lastKnownNonce.TryGetValue(sender, out var knownNonce))
                {
                    nonce = knownNonce;
                    _lastKnownNonce[sender] = nonce + 1;
                    _logger.LogInformation("Sử dụng local tracked nonce {Nonce} cho {Sender}", nonce, sender);
                    return nonce;
                }

                // Lấy nonce từ blockchain
                try
                {
                    var nonceValue = await _web3.Eth.Transactions.GetTransactionCount.SendRequestAsync(sender);
                    nonce = nonceValue.Value;
                    _lastKnownNonce[sender] = nonce + 1;
                    _logger.LogInformation("Lấy nonce mới {Nonce} cho {Sender} từ blockchain", nonce, sender);
                    return nonce;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi lấy nonce cho {Sender}", sender);
                    nonce = 0;
                    _lastKnownNonce[sender] = 1;
                    return nonce;
                }
            }
            finally
            {
                _nonceLock.Release();
            }
        }

        public async Task<string> SendUserOperation(UserOperation userOp)
        {
            if (userOp == null)
            {
                _logger.LogWarning("Nhận được UserOperation null");
                throw new ArgumentNullException(nameof(userOp), "UserOperation không được để trống");
            }

            // Phần code xác thực và kiểm tra đã có

            // Ưu tiên sử dụng UserOpHash từ frontend
            string userOpHash;
            string backendHash = CalculateUserOpHash(userOp);

            if (!string.IsNullOrEmpty(userOp.UserOpHash))
            {
                userOpHash = userOp.UserOpHash;
                _logger.LogInformation("Hash từ frontend: {FrontendHash}, hash tính bởi server: {ServerHash}",
                    userOpHash, backendHash);

                // Lưu mối quan hệ giữa các hash để theo dõi
                lock (_lock)
                {
                    _hashRelationships[userOpHash] = backendHash;
                    _hashRelationships[backendHash] = userOpHash;
                }
            }
            else
            {
                userOpHash = backendHash;
                _logger.LogInformation("Không có hash từ frontend, sử dụng hash tính bởi server: {ServerHash}", userOpHash);
            }

            // CẬP NHẬT HASH TRONG ĐỐI TƯỢNG
            userOp.UserOpHash = userOpHash;

            // Kiểm tra nếu userOp tương tự đã được xử lý trước đó
            var existingTxHash = await CheckExistingTransactionAsync(userOpHash, backendHash);
            if (!string.IsNullOrEmpty(existingTxHash))
            {
                _logger.LogInformation("UserOperation tương tự đã được gửi trước đó với txHash: {TxHash}", existingTxHash);
                return $"existing:{existingTxHash}";
            }

            lock (_lock)
            {
                if (!_retryCounts.ContainsKey(userOp.Sender))
                {
                    _retryCounts[userOp.Sender] = 0; // Khởi tạo số lần thử lại
                }
                _queue.Add(userOp);
                _logger.LogInformation("Đã thêm UserOp từ {Sender} với hash {UserOpHash}. Kích thước hàng đợi: {QueueSize}",
                    userOp.Sender, userOpHash, _queue.Count);

                // Ghi nhận UserOperation vào database ngay lập tức để theo dõi
                Task.Run(async () => {
                    try
                    {
                        await RecordUserOperationAsync(userOp, userOpHash, backendHash);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi ghi nhận UserOperation vào database");
                    }
                });

                // Giảm số lượng tụ đồng trong hàng đợi trước khi trigger bundling
                if (_queue.Count >= _maxQueueSize && _maxQueueSize > 0)
                {
                    Task.Run(async () => await BundleAndSend());
                    return $"bundling:{userOpHash}";
                }
            }

            // Chuyển xuống 10s để xử lý nhanh hơn
            if (_queue.Count > 1)
            {
                Task.Run(async () => {
                    await Task.Delay(1000); // Đợi 1 giây để có cơ hội gom nhóm các yêu cầu liên tiếp
                    await BundleAndSend();
                });
            }

            return $"pending:{userOpHash}";
        }

        // Kiểm tra giao dịch tương tự đã tồn tại
        private async Task<string> CheckExistingTransactionAsync(string userOpHash, string backendHash)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    // Kiểm tra cả hai hash
                    var transaction = await dbContext.BlockchainTransactions
                        .FirstOrDefaultAsync(t => (t.TransactionHash == userOpHash || t.TransactionHash == backendHash) &&
                                                 (t.TrangThai == 0 || t.TrangThai == 1));

                    if (transaction != null && !string.IsNullOrEmpty(transaction.MetaData))
                    {
                        try
                        {
                            var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);
                            if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                            {
                                var txHash = txHashElement.GetString();
                                if (!string.IsNullOrEmpty(txHash))
                                {
                                    // Kiểm tra trạng thái trên blockchain
                                    var receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(txHash);
                                    if (receipt != null)
                                    {
                                        return txHash;
                                    }
                                }
                            }
                        }
                        catch (Exception) { /* Bỏ qua lỗi parse JSON */ }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra giao dịch tương tự");
            }

            return null;
        }

        // Ghi nhận thông tin UserOperation vào database
        private async Task RecordUserOperationAsync(UserOperation userOp, string frontendHash, string backendHash)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    // Ghi bản ghi cho hash frontend
                    var transaction = new BlockchainTransaction
                    {
                        TransactionHash = frontendHash,
                        LoaiGiaoDich = "USER_OPERATION",
                        TrangThai = 0, // Pending
                        NgayTao = DateTime.UtcNow,
                        NgayCapNhat = DateTime.UtcNow,
                        BlockNumber = 0,
                        DoiTuongId = 0,
                        LoaiDoiTuong = "UserOperation",
                        MetaData = System.Text.Json.JsonSerializer.Serialize(new
                        {
                            sender = userOp.Sender,
                            nonce = userOp.Nonce,
                            callGasLimit = userOp.CallGasLimit,
                            hasPaymaster = !string.IsNullOrEmpty(userOp.PaymasterAndData) && userOp.PaymasterAndData != "0x",
                            frontendHash = frontendHash,
                            backendHash = backendHash,
                            timestamp = DateTime.UtcNow
                        })
                    };

                    dbContext.BlockchainTransactions.Add(transaction);
                    await dbContext.SaveChangesAsync();

                    // Nếu hash frontend khác với hash backend, tạo bản ghi tham chiếu
                    if (frontendHash != backendHash)
                    {
                        var refTransaction = new BlockchainTransaction
                        {
                            TransactionHash = backendHash,
                            LoaiGiaoDich = "USER_OPERATION_REF",
                            TrangThai = 0, // Pending
                            NgayTao = DateTime.UtcNow,
                            NgayCapNhat = DateTime.UtcNow,
                            BlockNumber = 0,
                            DoiTuongId = 0,
                            LoaiDoiTuong = "UserOperation",
                            MetaData = System.Text.Json.JsonSerializer.Serialize(new
                            {
                                frontendHash = frontendHash,
                                sender = userOp.Sender,
                                nonce = userOp.Nonce,
                                timestamp = DateTime.UtcNow
                            })
                        };

                        dbContext.BlockchainTransactions.Add(refTransaction);
                        await dbContext.SaveChangesAsync();
                    }

                    _logger.LogInformation("Đã ghi nhận UserOperation vào database, frontendHash: {FrontendHash}, backendHash: {BackendHash}",
                        frontendHash, backendHash);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi ghi nhận UserOperation vào database");
            }
        }

        // Cập nhật trạng thái UserOperation trong database
        private async Task UpdateUserOperationStatusAsync(string userOpHash, string txHash, int status, long blockNumber = 0)
        {
            if (string.IsNullOrEmpty(userOpHash))
            {
                _logger.LogWarning("UpdateUserOperationStatusAsync được gọi với userOpHash rỗng");
                return;
            }

            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    try
                    {
                        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                        // Tìm giao dịch trực tiếp bằng hash
                        var transaction = await dbContext.BlockchainTransactions
                            .FirstOrDefaultAsync(t => t.TransactionHash == userOpHash);

                        if (transaction != null)
                        {
                            transaction.TrangThai = status;
                            transaction.NgayCapNhat = DateTime.UtcNow;

                            if (blockNumber > 0)
                            {
                                transaction.BlockNumber = blockNumber;
                            }

                            // Cập nhật metadata với actualTxHash
                            var metadataObj = new Dictionary<string, object>();
                            try
                            {
                                if (!string.IsNullOrEmpty(transaction.MetaData))
                                {
                                    var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData ?? "{}");
                                    foreach (var element in metadata.RootElement.EnumerateObject())
                                    {
                                        metadataObj[element.Name] = element.Value.ToString();
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Lỗi khi parse metadata, tạo metadata mới: {Error}", ex.Message);
                            }

                            // Thêm txHash vào metadata
                            if (!string.IsNullOrEmpty(txHash) && txHash != userOpHash)
                            {
                                metadataObj["actualTxHash"] = txHash;
                                metadataObj["updatedAt"] = DateTime.UtcNow.ToString("o");

                                // Thêm thông tin trạng thái và blockNumber
                                if (status > 0)
                                {
                                    metadataObj["status"] = status.ToString();
                                    if (blockNumber > 0)
                                    {
                                        metadataObj["blockNumber"] = blockNumber.ToString();
                                    }
                                }
                            }

                            transaction.MetaData = System.Text.Json.JsonSerializer.Serialize(metadataObj);
                            await dbContext.SaveChangesAsync();

                            _logger.LogInformation("Đã cập nhật trạng thái UserOperation {UserOpHash} thành {Status} với actualTxHash {TxHash}",
                                userOpHash, status, txHash);

                            // Tìm kiếm bản ghi tham chiếu để cập nhật
                            string relatedHash = null;

                            // Kiểm tra mối quan hệ hash đã được lưu
                            lock (_lock)
                            {
                                if (_hashRelationships.TryGetValue(userOpHash, out relatedHash))
                                {
                                    _logger.LogInformation("Tìm thấy hash liên quan: {RelatedHash} cho {UserOpHash}", relatedHash, userOpHash);
                                }
                            }

                            // Nếu không có trong dictionary, thử tìm trong metadata
                            if (string.IsNullOrEmpty(relatedHash))
                            {
                                try
                                {
                                    var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData ?? "{}");
                                    if (metadata.RootElement.TryGetProperty("frontendHash", out var frontendHashElement))
                                    {
                                        relatedHash = frontendHashElement.GetString();
                                    }
                                    else if (metadata.RootElement.TryGetProperty("backendHash", out var backendHashElement))
                                    {
                                        relatedHash = backendHashElement.GetString();
                                    }
                                }
                                catch { /* Bỏ qua lỗi khi parse JSON */ }
                            }

                            // Nếu tìm thấy hash liên quan, cập nhật cả bản ghi đó
                            if (!string.IsNullOrEmpty(relatedHash) && relatedHash != userOpHash)
                            {
                                var relatedTransaction = await dbContext.BlockchainTransactions
                                    .FirstOrDefaultAsync(t => t.TransactionHash == relatedHash);

                                if (relatedTransaction != null)
                                {
                                    relatedTransaction.TrangThai = status;
                                    relatedTransaction.NgayCapNhat = DateTime.UtcNow;

                                    if (blockNumber > 0)
                                    {
                                        relatedTransaction.BlockNumber = blockNumber;
                                    }

                                    // Cập nhật metadata
                                    var relatedMetadataObj = new Dictionary<string, object>();
                                    try
                                    {
                                        if (!string.IsNullOrEmpty(relatedTransaction.MetaData))
                                        {
                                            var metadata = System.Text.Json.JsonDocument.Parse(relatedTransaction.MetaData ?? "{}");
                                            foreach (var element in metadata.RootElement.EnumerateObject())
                                            {
                                                relatedMetadataObj[element.Name] = element.Value.ToString();
                                            }
                                        }
                                    }
                                    catch { /* Bỏ qua lỗi */ }

                                    // Thêm txHash
                                    if (!string.IsNullOrEmpty(txHash))
                                    {
                                        relatedMetadataObj["actualTxHash"] = txHash;
                                        relatedMetadataObj["updatedAt"] = DateTime.UtcNow.ToString("o");

                                        // Thêm thông tin trạng thái và blockNumber
                                        if (status > 0)
                                        {
                                            relatedMetadataObj["status"] = status.ToString();
                                            if (blockNumber > 0)
                                            {
                                                relatedMetadataObj["blockNumber"] = blockNumber.ToString();
                                            }
                                        }
                                    }

                                    relatedTransaction.MetaData = System.Text.Json.JsonSerializer.Serialize(relatedMetadataObj);

                                    await dbContext.SaveChangesAsync();
                                    _logger.LogInformation("Đã cập nhật trạng thái cho hash liên quan {RelatedHash} thành {Status} với actualTxHash {TxHash}",
                                        relatedHash, status, txHash);
                                }
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Không tìm thấy UserOperation {UserOpHash} trong database khi cập nhật trạng thái", userOpHash);

                            // Tạo bản ghi mới nếu không tồn tại
                            if (!string.IsNullOrEmpty(txHash))
                            {
                                var newTransaction = new BlockchainTransaction
                                {
                                    TransactionHash = userOpHash,
                                    LoaiGiaoDich = "USER_OPERATION",
                                    TrangThai = status,
                                    NgayTao = DateTime.UtcNow,
                                    NgayCapNhat = DateTime.UtcNow,
                                    BlockNumber = blockNumber,
                                    MetaData = System.Text.Json.JsonSerializer.Serialize(new
                                    {
                                        actualTxHash = txHash,
                                        createdAt = DateTime.UtcNow.ToString("o"),
                                        status = status.ToString(),
                                        blockNumber = blockNumber > 0 ? blockNumber.ToString() : null
                                    })
                                };

                                dbContext.BlockchainTransactions.Add(newTransaction);
                                await dbContext.SaveChangesAsync();
                                _logger.LogInformation("Đã tạo bản ghi mới cho UserOperation {UserOpHash} với trạng thái {Status} và actualTxHash {TxHash}",
                                    userOpHash, status, txHash);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi truy cập database trong UpdateUserOperationStatusAsync: {Error}", ex.Message);
                    }
                }
            }
            catch (ObjectDisposedException ex)
            {
                _logger.LogError(ex, "IServiceProvider đã bị disposed khi cập nhật trạng thái UserOperation {UserOpHash}", userOpHash);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khác khi cập nhật trạng thái UserOperation {UserOpHash}: {Error}", userOpHash, ex.Message);
            }
        }

        private async Task BundleAndSendTimerCallback()
        {
            try
            {
                lock (_lock)
                {
                    if (_queue.Count == 0)
                    {
                        return;
                    }
                }
                await BundleAndSend();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi trong bundling timer callback");
            }
        }

        // Kiểm tra và cập nhật trạng thái các giao dịch đã gửi
        private async Task CheckPendingTransactionsAsync()
        {
            try
            {
                List<string> userOpHashesToCheck;
                List<string> txHashesToCheck;

                lock (_lock)
                {
                    // Lấy danh sách UserOpHash cần kiểm tra
                    userOpHashesToCheck = _sentTransactions.Keys.ToList();
                    txHashesToCheck = _sentTransactions.Values.Distinct().ToList();

                    // Lọc ra các giao dịch chưa được xác nhận
                    txHashesToCheck = txHashesToCheck.Where(hash => !_confirmedTransactions.Contains(hash)).ToList();
                }

                if (txHashesToCheck.Count == 0)
                {
                    return;
                }

                _logger.LogDebug("Đang kiểm tra trạng thái của {Count} giao dịch chưa được xác nhận", txHashesToCheck.Count);

                // Lấy dữ liệu từ blockchain cho mỗi txHash
                foreach (var txHash in txHashesToCheck.ToList()) // Sử dụng ToList để tránh lỗi collection modified
                {
                    try
                    {
                        var receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(txHash);
                        if (receipt != null)
                        {
                            // Thêm vào danh sách đã xác nhận để ngừng kiểm tra
                            lock (_lock)
                            {
                                _confirmedTransactions.Add(txHash);
                            }

                            // Tìm tất cả các userOpHash liên quan (cả frontend và backend) dựa vào metadata
                            List<string> relatedUserOps = new List<string>();

                            // Thêm các hash liên kết trực tiếp
                            relatedUserOps.AddRange(_sentTransactions
                                .Where(kv => kv.Value == txHash)
                                .Select(kv => kv.Key));

                            // Thêm các hash tham chiếu từ _hashRelationships
                            lock (_lock)
                            {
                                foreach (var userOpHash in relatedUserOps.ToList())
                                {
                                    if (_hashRelationships.TryGetValue(userOpHash, out var relatedHash))
                                    {
                                        relatedUserOps.Add(relatedHash);
                                    }
                                }
                            }

                            // Thêm các hash tham chiếu có thể có từ database
                            try
                            {
                                using (var scope = _serviceProvider.CreateScope())
                                {
                                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                                    // Tìm các giao dịch tham chiếu
                                    var txs = await dbContext.BlockchainTransactions
                                        .Where(t => t.LoaiGiaoDich == "USER_OPERATION_REF" &&
                                                    t.MetaData.Contains(txHash))
                                        .ToListAsync();

                                    foreach (var tx in txs)
                                    {
                                        relatedUserOps.Add(tx.TransactionHash);
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Lỗi khi tìm các hash tham chiếu từ database");
                            }

                            // Cập nhật trạng thái cho tất cả UserOperation liên quan
                            foreach (var userOpHash in relatedUserOps.Distinct())
                            {
                                await UpdateUserOperationStatusAsync(
                                    userOpHash,
                                    txHash,
                                    receipt.Status.Value == 1 ? 1 : 2, // 1: Success, 2: Failed
                                    (long)receipt.BlockNumber.Value);

                                lock (_lock)
                                {
                                    _sentTransactions.Remove(userOpHash);
                                    _sentTimestamps.Remove(userOpHash);

                                    // Xóa khỏi hàng đợi giao dịch nếu còn trong đó
                                    var pendingOpIndex = _queue.FindIndex(op => op.UserOpHash == userOpHash);
                                    if (pendingOpIndex >= 0)
                                    {
                                        _queue.RemoveAt(pendingOpIndex);
                                    }
                                }
                            }

                            // Thông báo once, không cần kiểm tra lại
                            _logger.LogInformation("Giao dịch {TxHash} đã được xác nhận trong block {BlockNumber}, status: {Status}",
                                txHash, receipt.BlockNumber, receipt.Status.Value);
                        }
                        else
                        {
                            _logger.LogDebug("Giao dịch {TxHash} vẫn đang chờ xác nhận", txHash);

                            // Kiểm tra thời gian timeout (giảm xuống 10 phút)
                            var userOpsUsingThisTx = _sentTransactions
                                .Where(kv => kv.Value == txHash)
                                .Select(kv => kv.Key)
                                .ToList();

                            foreach (var userOpHash in userOpsUsingThisTx)
                            {
                                if (_sentTimestamps.TryGetValue(userOpHash, out var timestamp))
                                {
                                    if (DateTime.UtcNow - timestamp > _transactionTimeout)
                                    {
                                        _logger.LogWarning("UserOperation {UserOpHash} đã quá thời gian chờ ({TimeoutMinutes} phút), đánh dấu là thất bại",
                                            userOpHash, _transactionTimeout.TotalMinutes);
                                        await UpdateUserOperationStatusAsync(userOpHash, txHash, 3); // 3: Timeout

                                        lock (_lock)
                                        {
                                            _sentTransactions.Remove(userOpHash);
                                            _sentTimestamps.Remove(userOpHash);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi kiểm tra giao dịch {TxHash}", txHash);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra các giao dịch đang chờ");
            }
        }

        private async Task BundleAndSend()
        {
            List<UserOperation> userOpsToSend;

            lock (_lock)
            {
                if (_queue.Count == 0) return;
                userOpsToSend = new List<UserOperation>(_queue);
                _queue.Clear();
                _logger.LogInformation("Đang bundle {Count} UserOps...", userOpsToSend.Count);
            }

            // Xử lý các UserOp theo batch nhỏ hơn để tránh quá tải
            const int MAX_BATCH_SIZE = 10;

            if (userOpsToSend.Count > MAX_BATCH_SIZE)
            {
                _logger.LogInformation("Chia {TotalCount} UserOps thành các batch nhỏ hơn", userOpsToSend.Count);

                for (int i = 0; i < userOpsToSend.Count; i += MAX_BATCH_SIZE)
                {
                    var batchSize = Math.Min(MAX_BATCH_SIZE, userOpsToSend.Count - i);
                    var batch = userOpsToSend.GetRange(i, batchSize);

                    // Xử lý batch nhỏ
                    await ProcessBatch(batch);

                    // Đợi một chút trước khi xử lý batch tiếp theo
                    if (i + MAX_BATCH_SIZE < userOpsToSend.Count)
                    {
                        await Task.Delay(1000); // 1 giây
                    }
                }
            }
            else
            {
                // Xử lý tất cả nếu số lượng ít
                await ProcessBatch(userOpsToSend);
            }
        }

        // Phương thức xử lý một batch UserOperation
        private async Task ProcessBatch(List<UserOperation> userOps)
        {
            try
            {
                // Lấy địa chỉ người thụ hưởng (người gửi giao dịch)
                var beneficiary = _web3.TransactionManager.Account.Address;
                _logger.LogInformation("Beneficiary address: {Beneficiary}", beneficiary);

                // Lấy thông tin gas hiện tại
                var gasPrice = await _blockchainService.GetCurrentGasPrice();
                _logger.LogInformation("Gas price hiện tại: {GasPrice} wei", gasPrice);

                // Tính tổng gas ước tính cho tất cả UserOperation
                var estimatedGas = BigInteger.Zero;
                foreach (var op in userOps)
                {
                    // Bảo đảm op.CallGasLimit, op.VerificationGasLimit, op.PreVerificationGas là kiểu string
                    BigInteger callGasLimit;
                    BigInteger verificationGasLimit;
                    BigInteger preVerificationGas;

                    // Sử dụng Parse thay vì TryParse để tránh lỗi System.ReadOnlySpan<char>
                    if (!string.IsNullOrEmpty(op.CallGasLimit.ToString()))
                        BigInteger.TryParse(op.CallGasLimit.ToString(), out callGasLimit);
                    else
                        callGasLimit = 1000000; // Default value

                    if (!string.IsNullOrEmpty(op.VerificationGasLimit.ToString()))
                        BigInteger.TryParse(op.VerificationGasLimit.ToString(), out verificationGasLimit);
                    else
                        verificationGasLimit = 500000; // Default value

                    if (!string.IsNullOrEmpty(op.PreVerificationGas.ToString()))
                        BigInteger.TryParse(op.PreVerificationGas.ToString(), out preVerificationGas);
                    else
                        preVerificationGas = 100000; // Default value

                    estimatedGas += callGasLimit + verificationGasLimit + preVerificationGas;
                }

                // Thêm buffer 50% cho tổng gas
                estimatedGas = estimatedGas * 150 / 100;
                _logger.LogInformation("Tổng gas ước tính cho {Count} UserOps: {Gas}", userOps.Count, estimatedGas);

                // Lấy interface của EntryPoint contract
                var entryPointContract = _web3.Eth.GetContract(ContractABIs.EntryPoint, _entryPointAddress);
                var xuLyCacThaoTacFunction = entryPointContract.GetFunction("xuLyCacThaoTac");

                // === FIX: Chuẩn bị mảng UserOperations cẩn thận hơn ===
                var userOpsArray = new object[userOps.Count][];

                // Chuyển đổi tất cả các chuỗi hex thành byte arrays
                for (int i = 0; i < userOps.Count; i++)
                {
                    var op = userOps[i];

                    // Chuyển đổi rõ ràng các chuỗi hex thành byte[]
                    byte[] initCodeBytes = string.IsNullOrEmpty(op.InitCode) || op.InitCode == "0x"
                        ? new byte[0] : op.InitCode.HexToByteArray();

                    byte[] callDataBytes = string.IsNullOrEmpty(op.CallData) || op.CallData == "0x"
                        ? new byte[0] : op.CallData.HexToByteArray();

                    byte[] paymasterAndDataBytes = string.IsNullOrEmpty(op.PaymasterAndData) || op.PaymasterAndData == "0x"
                        ? new byte[0] : op.PaymasterAndData.HexToByteArray();

                    byte[] signatureBytes = string.IsNullOrEmpty(op.Signature) || op.Signature == "0x"
                        ? new byte[0] : op.Signature.HexToByteArray();

                    // Log các giá trị đầu vào để debug
                    _logger.LogDebug("UserOp[{Index}] - InitCode length: {InitLength}, CallData length: {CallLength}, " +
                        "PaymasterAndData length: {PaymasterLength}, Signature length: {SigLength}",
                        i, initCodeBytes.Length, callDataBytes.Length, paymasterAndDataBytes.Length, signatureBytes.Length);

                    userOpsArray[i] = new object[]
                    {
                        op.Sender,
                        op.Nonce,
                        initCodeBytes,           // Sử dụng byte[] thay vì string
                        callDataBytes,           // Sử dụng byte[] thay vì string
                        op.CallGasLimit,
                        op.VerificationGasLimit,
                        op.PreVerificationGas,
                        op.MaxFeePerGas,
                        op.MaxPriorityFeePerGas,
                        paymasterAndDataBytes,   // Sử dụng byte[] thay vì string
                        signatureBytes           // Sử dụng byte[] thay vì string
                    };
                }

                // === ĐỔI MỚI: Dùng SendRawTransaction thay vì SendTransaction ===
                try
                {
                    // Tạo transaction input
                    var maxFeePerGas = new HexBigInteger(BigInteger.Max(gasPrice * 2, 1000000000)); // min 1 gwei
                    var maxPriorityFeePerGas = new HexBigInteger(BigInteger.Max(gasPrice, 500000000)); // min 0.5 gwei

                    // Lấy nonce giao dịch hiện tại
                    var txNonce = await _web3.Eth.Transactions.GetTransactionCount.SendRequestAsync(
                        _web3.TransactionManager.Account.Address,
                        Nethereum.RPC.Eth.DTOs.BlockParameter.CreatePending());

                    // Đặt data cho transaction
                    string data;
                    try
                    {
                        data = xuLyCacThaoTacFunction.GetData(userOpsArray, beneficiary);
                        _logger.LogDebug("Đã tạo transaction data thành công, kích thước: {Size} bytes",
                            data.Length > 2 ? (data.Length - 2) / 2 : 0);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi mã hóa transaction data: {Error}", ex.Message);
                        throw;
                    }

                    // Lấy chainId
                    var chainId = await _web3.Eth.ChainId.SendRequestAsync();

                    // Chuẩn bị TransactionInput
                    var txInput = new Nethereum.RPC.Eth.DTOs.TransactionInput
                    {
                        From = _web3.TransactionManager.Account.Address,
                        To = _entryPointAddress,
                        Gas = new HexBigInteger(estimatedGas),
                        Nonce = txNonce,
                        MaxFeePerGas = maxFeePerGas,
                        MaxPriorityFeePerGas = maxPriorityFeePerGas,
                        Data = data
                    };

                    // Ký giao dịch ngoại tuyến
                    var account = new Nethereum.Web3.Accounts.Account(_adminPrivateKey);
                    string signedTransaction;

                    // Cách ký trực tiếp
                    var web3WithAccount = new Web3(account, _web3.Client);
                    signedTransaction = await web3WithAccount.TransactionManager.SignTransactionAsync(txInput);

                    _logger.LogInformation("Giao dịch đã được ký ngoại tuyến, gửi raw transaction...");

                    // Gửi giao dịch đã ký
                    var txHash = await _web3.Eth.Transactions.SendRawTransaction.SendRequestAsync(signedTransaction);
                    _logger.LogInformation("Đã gửi xuLyCacThaoTac transaction: {TxHash}", txHash);

                    // THÊM MỚI: Lưu actualTxHash vào database
                    foreach (var op in userOps)
                    {
                        var userOpHash = op.UserOpHash;

                        // Lưu mối quan hệ UserOpHash -> TxHash
                        lock (_lock)
                        {
                            _sentTransactions[userOpHash] = txHash;
                            _sentTimestamps[userOpHash] = DateTime.UtcNow;

                            // Nếu có hash tham chiếu, lưu cả nó
                            if (_hashRelationships.TryGetValue(userOpHash, out var relatedHash))
                            {
                                _sentTransactions[relatedHash] = txHash;
                                _sentTimestamps[relatedHash] = DateTime.UtcNow;
                            }
                        }

                        // Lưu thông tin txHash vào database - CẬP NHẬT MỚI
                        try
                        {
                            using (var scope = _serviceProvider.CreateScope())
                            {
                                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                                // Tìm bản ghi hiện tại
                                var transaction = await dbContext.BlockchainTransactions
                                    .FirstOrDefaultAsync(t => t.TransactionHash == userOpHash);

                                if (transaction != null)
                                {
                                    // Cập nhật metadata với txHash
                                    var metadataObj = new Dictionary<string, object>();
                                    try
                                    {
                                        if (!string.IsNullOrEmpty(transaction.MetaData))
                                        {
                                            var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);
                                            foreach (var element in metadata.RootElement.EnumerateObject())
                                            {
                                                metadataObj[element.Name] = element.Value.ToString();
                                            }
                                        }
                                    }
                                    catch { /* ignore parsing errors */ }

                                    // Thêm txHash vào metadata
                                    metadataObj["actualTxHash"] = txHash;
                                    metadataObj["bundledAt"] = DateTime.UtcNow.ToString("o");
                                    transaction.MetaData = System.Text.Json.JsonSerializer.Serialize(metadataObj);

                                    await dbContext.SaveChangesAsync();
                                    _logger.LogInformation("Đã lưu actualTxHash {TxHash} vào metadata của UserOperation {UserOpHash}",
                                        txHash, userOpHash);

                                    // Tìm hash liên quan để cập nhật
                                    string relatedHash = null;
                                    lock (_lock)
                                    {
                                        if (_hashRelationships.TryGetValue(userOpHash, out relatedHash) && !string.IsNullOrEmpty(relatedHash))
                                        {
                                            _logger.LogInformation("Tìm thấy hash liên quan: {RelatedHash} cho {UserOpHash}", relatedHash, userOpHash);
                                        }
                                    }

                                    if (!string.IsNullOrEmpty(relatedHash))
                                    {
                                        var relatedTransaction = await dbContext.BlockchainTransactions
                                            .FirstOrDefaultAsync(t => t.TransactionHash == relatedHash);

                                        if (relatedTransaction != null)
                                        {
                                            var relatedMetadataObj = new Dictionary<string, object>();
                                            try
                                            {
                                                if (!string.IsNullOrEmpty(relatedTransaction.MetaData))
                                                {
                                                    var metadata = System.Text.Json.JsonDocument.Parse(relatedTransaction.MetaData);
                                                    foreach (var element in metadata.RootElement.EnumerateObject())
                                                    {
                                                        relatedMetadataObj[element.Name] = element.Value.ToString();
                                                    }
                                                }
                                            }
                                            catch { /* ignore parsing errors */ }

                                            relatedMetadataObj["actualTxHash"] = txHash;
                                            relatedMetadataObj["bundledAt"] = DateTime.UtcNow.ToString("o");
                                            relatedTransaction.MetaData = System.Text.Json.JsonSerializer.Serialize(relatedMetadataObj);

                                            await dbContext.SaveChangesAsync();
                                            _logger.LogInformation("Đã lưu actualTxHash {TxHash} vào metadata của hash liên quan {RelatedHash}",
                                                txHash, relatedHash);
                                        }
                                    }

                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Lỗi khi lưu actualTxHash vào database cho UserOperation {UserOpHash}", userOpHash);
                        }

                        // Cập nhật trạng thái trong database
                        await UpdateUserOperationStatusAsync(userOpHash, txHash, 0); // 0: Pending

                        _logger.LogInformation("UserOperation {UserOpHash} đã được gửi trong transaction {TxHash}", userOpHash, txHash);
                    }

                    // Kiểm tra receipt (với timeout)
                    var receiptTask = _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(txHash);

                    // Giảm timeout xuống 10 giây
                    var completedTask = await Task.WhenAny(receiptTask, Task.Delay(10000));

                    if (completedTask == receiptTask)
                    {
                        var receipt = await receiptTask;
                        if (receipt != null)
                        {
                            // Thêm vào danh sách đã xác nhận để ngừng kiểm tra
                            lock (_lock)
                            {
                                _confirmedTransactions.Add(txHash);
                            }

                            _logger.LogInformation("Transaction {TxHash} đã được xác nhận trong block {BlockNumber}, status: {Status}",
                                txHash, receipt.BlockNumber, receipt.Status.Value);

                            // Cập nhật trạng thái cho tất cả UserOperation
                            foreach (var op in userOps)
                            {
                                var userOpHash = op.UserOpHash;
                                await UpdateUserOperationStatusAsync(
                                    userOpHash,
                                    txHash,
                                    receipt.Status.Value == 1 ? 1 : 2, // 1: Success, 2: Failed
                                    (long)receipt.BlockNumber.Value);

                                // Xóa khỏi danh sách đã gửi
                                lock (_lock)
                                {
                                    _sentTransactions.Remove(userOpHash);
                                    _sentTimestamps.Remove(userOpHash);
                                }
                            }
                        }
                        else
                        {
                            _logger.LogInformation("Transaction {TxHash} vẫn đang chờ xác nhận sau 10 giây", txHash);
                        }
                    }
                    else
                    {
                        _logger.LogInformation("Đang đợi xác nhận cho transaction {TxHash}, sẽ kiểm tra sau", txHash);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi gửi transaction đã ký: {Error}", ex.Message);
                    throw; // Re-throw để xử lý tiếp
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gửi bundled tx: {Error}", ex.Message);

                // Đánh dấu lỗi cho tất cả UserOperation
                foreach (var op in userOps)
                {
                    var userOpHash = op.UserOpHash;
                    _logger.LogWarning("UserOperation {UserOpHash} từ {Sender} bị lỗi: {Error}",
                        userOpHash, op.Sender, ex.Message);

                    // Cập nhật trạng thái trong database
                    await UpdateUserOperationStatusAsync(userOpHash, "", 2); // 2: Failed
                }

                // Thử lại các UserOperation nếu cần
                RequeueOperations(userOps);
            }
        }

        // Cải tiến việc xử lý lỗi và retry
        private void RequeueOperations(List<UserOperation> userOps)
        {
            lock (_lock)
            {
                var groupedByNonce = userOps.GroupBy(op => op.Sender).ToList();

                foreach (var group in groupedByNonce)
                {
                    var sender = group.Key;
                    var retryCount = _retryCounts.TryGetValue(sender, out var count) ? count : 0;

                    if (retryCount < MaxRetryCount)
                    {
                        // Tăng số lần thử
                        _retryCounts[sender] = retryCount + 1;

                        // Sắp xếp theo nonce nếu có thể parse
                        var sortedOps = group.OrderBy(op => {
                            if (BigInteger.TryParse(op.Nonce.ToString(), out var nonce))
                                return nonce;
                            return BigInteger.Zero;
                        }).ToList();

                        // Chỉ thêm lại vào đầu hàng đợi
                        foreach (var op in sortedOps)
                        {
                            _queue.Insert(0, op);
                            _logger.LogWarning("Thêm lại UserOp từ {Sender} với nonce {Nonce} vào đầu hàng đợi, lần thử: {RetryCount}",
                                op.Sender, op.Nonce, retryCount + 1);
                        }
                    }
                    else
                    {
                        _logger.LogError("UserOps từ {Sender} đã vượt quá {MaxRetryCount} lần thử lại, bỏ qua", sender, MaxRetryCount);
                        _retryCounts.Remove(sender);
                    }
                }

                _logger.LogInformation("Kích thước hàng đợi sau khi requeue: {QueueSize}", _queue.Count);
            }
        }

        // Tính toán UserOpHash tương tự như trong EntryPoint.sol và script test
        public string CalculateUserOpHash(UserOperation userOp)
        {
            try
            {
                // QUAN TRỌNG: TYPE HASH PHẢI GIỐNG NHAU GIỮA FRONTEND VÀ BACKEND
                var userOpTypeHash = "0x23d30247bdce7ce5a45889a6b784d5d89d5d6b93ac8a68dabf22079189f9a6e7"; // Keccak256 của USER_OPERATION_TYPEHASH

                // Khởi tạo các dữ liệu cần thiết từ UserOperation
                string sender = userOp.Sender;

                // Chuyển đổi các giá trị sang string một cách an toàn
                string nonce = userOp.Nonce.ToString();
                string initCode = string.IsNullOrEmpty(userOp.InitCode) ? "0x" : userOp.InitCode;
                string callData = string.IsNullOrEmpty(userOp.CallData) ? "0x" : userOp.CallData;

                // Chuyển đổi các giá trị BigInteger sang string
                string callGasLimit = userOp.CallGasLimit.ToString();
                string verificationGasLimit = userOp.VerificationGasLimit.ToString();
                string preVerificationGas = userOp.PreVerificationGas.ToString();
                string maxFeePerGas = userOp.MaxFeePerGas.ToString();
                string maxPriorityFeePerGas = userOp.MaxPriorityFeePerGas.ToString();

                string paymasterAndData = string.IsNullOrEmpty(userOp.PaymasterAndData) ? "0x" : userOp.PaymasterAndData;

                // Tính toán hash các trường bytes
                var initCodeHash = Nethereum.Util.Sha3Keccack.Current.CalculateHash(
                    Nethereum.Hex.HexConvertors.Extensions.HexByteConvertorExtensions.HexToByteArray(initCode));
                var callDataHash = Nethereum.Util.Sha3Keccack.Current.CalculateHash(
                    Nethereum.Hex.HexConvertors.Extensions.HexByteConvertorExtensions.HexToByteArray(callData));
                var paymasterAndDataHash = Nethereum.Util.Sha3Keccack.Current.CalculateHash(
                    Nethereum.Hex.HexConvertors.Extensions.HexByteConvertorExtensions.HexToByteArray(paymasterAndData));

                // CHÚ Ý: Phải encode đúng thứ tự và type như frontend
                var abiEncoder = new Nethereum.ABI.ABIEncode();
                var packedUserOp = abiEncoder.GetABIEncoded(
                    new Nethereum.ABI.ABIValue("bytes32", Nethereum.Hex.HexConvertors.Extensions.HexByteConvertorExtensions.HexToByteArray(userOpTypeHash)),
                    new Nethereum.ABI.ABIValue("address", sender),
                    new Nethereum.ABI.ABIValue("uint256", nonce),
                    new Nethereum.ABI.ABIValue("bytes32", initCodeHash),
                    new Nethereum.ABI.ABIValue("bytes32", callDataHash),
                    new Nethereum.ABI.ABIValue("uint256", callGasLimit),
                    new Nethereum.ABI.ABIValue("uint256", verificationGasLimit),
                    new Nethereum.ABI.ABIValue("uint256", preVerificationGas),
                    new Nethereum.ABI.ABIValue("uint256", maxFeePerGas),
                    new Nethereum.ABI.ABIValue("uint256", maxPriorityFeePerGas),
                    new Nethereum.ABI.ABIValue("bytes32", paymasterAndDataHash)
                );

                // Tính hash giai đoạn 1
                var userOpHash = Nethereum.Util.Sha3Keccack.Current.CalculateHash(packedUserOp);

                // Lấy chain ID từ provider
                var chainId = _web3.Eth.ChainId.SendRequestAsync().Result.Value;

                // Encode với entryPoint và chainId, thứ tự phải giống frontend
                var encodedData = abiEncoder.GetABIEncoded(
                    new Nethereum.ABI.ABIValue("bytes32", userOpHash),
                    new Nethereum.ABI.ABIValue("address", _entryPointAddress),
                    new Nethereum.ABI.ABIValue("uint256", chainId)
                );

                // Tính hash cuối cùng
                var finalHashBytes = Nethereum.Util.Sha3Keccack.Current.CalculateHash(encodedData);
                var finalHashHex = "0x" + BitConverter.ToString(finalHashBytes).Replace("-", "").ToLowerInvariant();

                _logger.LogInformation("Tính toán UserOpHash tại server: {Hash}", finalHashHex);

                return finalHashHex;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tính UserOpHash");
                throw;
            }
        }

        public async Task<(bool success, string txHash, int blockNumber)> CheckUserOperationStatus(string userOpHash)
        {
            try
            {
                if (string.IsNullOrEmpty(userOpHash))
                {
                    _logger.LogWarning("CheckUserOperationStatus được gọi với userOpHash rỗng");
                    return (false, userOpHash, 0);
                }

                // Kiểm tra trong mối quan hệ hash
                string relatedHash = null;

                lock (_lock)
                {
                    if (_hashRelationships.TryGetValue(userOpHash, out relatedHash))
                    {
                        _logger.LogInformation("Tìm thấy hash liên quan: {RelatedHash} cho {UserOpHash}", relatedHash, userOpHash);
                    }
                }

                // THÊM MỚI: Tìm thông tin actualTxHash trong database
                string actualTxHash = null;
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                        var transaction = await dbContext.BlockchainTransactions
                            .FirstOrDefaultAsync(t => t.TransactionHash == userOpHash);

                        if (transaction != null && !string.IsNullOrEmpty(transaction.MetaData))
                        {
                            try
                            {
                                var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);
                                if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                                {
                                    actualTxHash = txHashElement.GetString();
                                    _logger.LogInformation("Tìm thấy actualTxHash {TxHash} cho UserOperation {UserOpHash} trong database",
                                        actualTxHash, userOpHash);

                                    // Kiểm tra trạng thái giao dịch
                                    if (!string.IsNullOrEmpty(actualTxHash))
                                    {
                                        // Kiểm tra xem đã xác nhận chưa
                                        lock (_lock)
                                        {
                                            if (_confirmedTransactions.Contains(actualTxHash))
                                            {
                                                // Đã xác nhận rồi, trả về trạng thái từ DB
                                                return (transaction.TrangThai == 1, actualTxHash, (int)transaction.BlockNumber);
                                            }
                                        }

                                        var receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(actualTxHash);
                                        if (receipt != null)
                                        {
                                            // Cập nhật trạng thái trong database
                                            await UpdateUserOperationStatusAsync(
                                                userOpHash,
                                                actualTxHash,
                                                receipt.Status.Value == 1 ? 1 : 2,
                                                (long)receipt.BlockNumber.Value);

                                            // Thêm vào danh sách đã xác nhận
                                            lock (_lock)
                                            {
                                                _confirmedTransactions.Add(actualTxHash);
                                            }

                                            return (receipt.Status.Value == 1, actualTxHash, (int)receipt.BlockNumber.Value);
                                        }
                                    }
                                }

                                // Kiểm tra xem đã thành công hay chưa dựa trên TrangThai
                                if (transaction.TrangThai == 1 && transaction.BlockNumber > 0)
                                {
                                    return (true, actualTxHash ?? userOpHash, (int)transaction.BlockNumber);
                                }
                                else if (transaction.TrangThai == 2 && transaction.BlockNumber > 0)
                                {
                                    return (false, actualTxHash ?? userOpHash, (int)transaction.BlockNumber);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Lỗi khi parse metadata để tìm actualTxHash: {Error}", ex.Message);
                            }
                        }

                        // Kiểm tra với hash liên quan
                        if (!string.IsNullOrEmpty(relatedHash))
                        {
                            var relatedTransaction = await dbContext.BlockchainTransactions
                                .FirstOrDefaultAsync(t => t.TransactionHash == relatedHash);

                            if (relatedTransaction != null && !string.IsNullOrEmpty(relatedTransaction.MetaData))
                            {
                                try
                                {
                                    var metadata = System.Text.Json.JsonDocument.Parse(relatedTransaction.MetaData);
                                    if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                                    {
                                        actualTxHash = txHashElement.GetString();
                                        _logger.LogInformation("Tìm thấy actualTxHash {TxHash} cho hash liên quan {RelatedHash} trong database",
                                            actualTxHash, relatedHash);

                                        // Kiểm tra trạng thái giao dịch
                                        if (!string.IsNullOrEmpty(actualTxHash))
                                        {
                                            var receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(actualTxHash);
                                            if (receipt != null)
                                            {
                                                // Cập nhật trạng thái trong database
                                                await UpdateUserOperationStatusAsync(
                                                    userOpHash,
                                                    actualTxHash,
                                                    receipt.Status.Value == 1 ? 1 : 2,
                                                    (long)receipt.BlockNumber.Value);

                                                return (receipt.Status.Value == 1, actualTxHash, (int)receipt.BlockNumber.Value);
                                            }
                                        }
                                    }

                                    // Kiểm tra xem đã thành công hay chưa dựa trên TrangThai
                                    if (relatedTransaction.TrangThai == 1 && relatedTransaction.BlockNumber > 0)
                                    {
                                        return (true, actualTxHash ?? relatedHash, (int)relatedTransaction.BlockNumber);
                                    }
                                    else if (relatedTransaction.TrangThai == 2 && relatedTransaction.BlockNumber > 0)
                                    {
                                        return (false, actualTxHash ?? relatedHash, (int)relatedTransaction.BlockNumber);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning(ex, "Lỗi khi parse metadata của hash liên quan: {Error}", ex.Message);
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tìm actualTxHash trong database: {Error}", ex.Message);
                }

                // Tạo scope mới mỗi lần truy cập database
                using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                    // Kiểm tra trong database
                    var transaction = await dbContext.BlockchainTransactions
                        .FirstOrDefaultAsync(t => t.TransactionHash == userOpHash);

                    // Nếu không tìm thấy bản ghi trực tiếp và có hash liên quan, kiểm tra với hash liên quan
                    if (transaction == null && !string.IsNullOrEmpty(relatedHash))
                    {
                        transaction = await dbContext.BlockchainTransactions
                            .FirstOrDefaultAsync(t => t.TransactionHash == relatedHash);
                    }

                    if (transaction != null)
                    {
                        // Kiểm tra trạng thái
                        if (transaction.TrangThai == 1) // Success
                        {
                            string txHash = userOpHash;

                            // Thử lấy txHash từ metadata nếu có
                            try
                            {
                                var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData ?? "{}");
                                if (metadata.RootElement.TryGetProperty("actualTxHash", out var txHashElement))
                                {
                                    txHash = txHashElement.GetString() ?? userOpHash;
                                }
                            }
                            catch { /* Ignore JSON parsing errors */ }

                            return (true, txHash, (int)transaction.BlockNumber);
                        }
                        else if (transaction.TrangThai == 2) // Failed
                        {
                            return (false, userOpHash, (int)transaction.BlockNumber);
                        }
                        else if (transaction.TrangThai == 3) // Timeout
                        {
                            return (false, userOpHash, 0);
                        }
                    }
                }

                // Kiểm tra trong danh sách đã gửi
                string associatedTxHash;
                lock (_lock)
                {
                    if (_sentTransactions.TryGetValue(userOpHash, out associatedTxHash))
                    {
                        // UserOp đã được gửi nhưng chưa được xác nhận
                        _logger.LogInformation("UserOperation {UserOpHash} đang chờ xác nhận trong tx {TxHash}", userOpHash, associatedTxHash);
                        return (false, associatedTxHash, 0);
                    }

                    // Nếu không tìm thấy trực tiếp nhưng có hash liên quan, kiểm tra với hash đó
                    if (!string.IsNullOrEmpty(relatedHash) && _sentTransactions.TryGetValue(relatedHash, out associatedTxHash))
                    {
                        _logger.LogInformation("UserOperation liên quan {RelatedHash} đang chờ xác nhận trong tx {TxHash}", relatedHash, associatedTxHash);
                        return (false, associatedTxHash, 0);
                    }
                }

                // Không tìm thấy trong database hoặc danh sách đã gửi
                _logger.LogWarning("UserOperation {UserOpHash} không được tìm thấy", userOpHash);
                return (false, userOpHash, 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi kiểm tra trạng thái UserOperation {UserOpHash}", userOpHash);
                return (false, userOpHash, 0);
            }
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_disposed)
            {
                if (disposing)
                {
                    _bundlingTimer?.Dispose();
                    _nonceLock?.Dispose(); // Giải phóng semaphore

                    lock (_lock)
                    {
                        _queue.Clear();
                        _retryCounts.Clear();
                        _sentTransactions.Clear();
                        _sentTimestamps.Clear();
                        _hashRelationships.Clear();
                        _lastKnownNonce.Clear();
                        _confirmedTransactions.Clear();
                    }
                }
                _disposed = true;
            }
        }
    }
}