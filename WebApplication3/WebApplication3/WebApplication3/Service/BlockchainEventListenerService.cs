using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.Web3;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WebApplication3.Contracts;
using WebApplication3.Data;
using WebApplication3.Models;
using Nethereum.RPC.Eth.DTOs;
using System.Numerics;
using System.Collections.Generic;
using Nethereum.Hex.HexTypes;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace WebApplication3.Services
{
    public class BlockchainEventListenerService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<BlockchainEventListenerService> _logger;
        private readonly string _rpcUrl;
        private readonly string _factoryAddress;

        // Thêm các biến cấu hình mới
        private readonly int _searchBlockRange;
        private readonly int _maxTransactionsPerRun;
        private readonly int _maxRetryCount;
        private readonly int _delayBetweenRunsSeconds;
        private readonly int _recoverTransactionsOlderThanHours;

        public BlockchainEventListenerService(
            IServiceProvider serviceProvider,
            ILogger<BlockchainEventListenerService> logger,
            Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _rpcUrl = configuration["BlockchainSettings:RpcUrl"];
            _factoryAddress = configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];

            // Đọc cấu hình từ appsettings.json hoặc sử dụng giá trị mặc định
            _searchBlockRange = int.TryParse(configuration["BlockchainSettings:SearchBlockRange"], out int blockRange)
                ? blockRange : 200; // Giảm xuống 200 block thay vì 1000

            _maxTransactionsPerRun = int.TryParse(configuration["BlockchainSettings:MaxTransactionsPerRun"], out int maxTx)
                ? maxTx : 10; // Giới hạn số lượng giao dịch xử lý mỗi lần

            _maxRetryCount = int.TryParse(configuration["BlockchainSettings:MaxRetryCount"], out int retryCount)
                ? retryCount : 5; // Giới hạn số lần thử lại

            _delayBetweenRunsSeconds = int.TryParse(configuration["BlockchainSettings:DelayBetweenRunsSeconds"], out int delay)
                ? delay : 10; // Delay mặc định là 10 giây

            _recoverTransactionsOlderThanHours = int.TryParse(configuration["BlockchainSettings:RecoverTransactionsOlderThanHours"], out int hours)
                ? hours : 24; // Chỉ khôi phục các giao dịch trong 24 giờ gần đây
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Blockchain Event Listener Service đang chạy.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Xử lý các giao dịch đang chờ (pending) trước
                    await ProcessPendingTransactions(stoppingToken);

                    // Xử lý giao dịch thông thường
                    await ProcessEvents(stoppingToken);

                    // Thực hiện recovery định kỳ (mỗi giờ)
                    if (DateTime.UtcNow.Minute == 0 && DateTime.UtcNow.Second < 10)
                    {
                        await RecoverDeployTransactions(stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi lắng nghe sự kiện blockchain: {Error}", ex.Message);
                }

                // Chờ trước khi thực hiện lại
                await Task.Delay(TimeSpan.FromSeconds(_delayBetweenRunsSeconds), stoppingToken);
            }
        }

        private async Task ProcessEvents(CancellationToken stoppingToken)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Tối ưu truy vấn: lấy tất cả giao dịch hợp lệ không có GetRetryCount
                var pendingTransactionsQuery = await dbContext.BlockchainTransactions
                    .Where(t => t.TrangThai == 0
                          && !string.IsNullOrEmpty(t.TransactionHash)
                          && t.TransactionHash.StartsWith("0x")
                          && t.TransactionHash.Length == 66)
                    .OrderBy(t => t.NgayTao)
                    .ToListAsync(stoppingToken);

                // Sau khi đã tải dữ liệu vào bộ nhớ, áp dụng GetRetryCount ở phía client
                var pendingTransactions = pendingTransactionsQuery
                    .Where(t => GetRetryCount(t) < _maxRetryCount)
                    .Take(_maxTransactionsPerRun)
                    .ToList();

                // Phần code còn lại giữ nguyên
                var successfulDeployTransactions = await dbContext.BlockchainTransactions
                    .Where(t => t.TrangThai == 1
                          && t.LoaiGiaoDich == "DEPLOY_SERVER"
                          && t.LoaiDoiTuong == "CuocBauCu"
                          && dbContext.CuocBauCus.Any(c => c.Id == t.DoiTuongId &&
                               (c.TrangThaiBlockchain == 1 || c.BlockchainServerId == null || c.BlockchainServerId == 0))
                          && !string.IsNullOrEmpty(t.TransactionHash)
                          && t.TransactionHash.StartsWith("0x")
                          && t.TransactionHash.Length == 66)
                    .OrderBy(t => t.NgayTao)
                    .Take(_maxTransactionsPerRun / 2) // Lấy ít hơn để ưu tiên xử lý giao dịch đang chờ
                    .ToListAsync(stoppingToken);

                var transactions = pendingTransactions.Concat(successfulDeployTransactions).ToList();

                if (transactions.Count == 0)
                {
                    return;
                }

                _logger.LogInformation("Xử lý {Count} giao dịch ({PendingCount} đang chờ, {SuccessfulCount} cần cập nhật cuộc bầu cử)",
                    transactions.Count, pendingTransactions.Count, successfulDeployTransactions.Count);

                var web3 = new Web3(_rpcUrl);

                foreach (var transaction in transactions)
                {
                    try
                    {
                        // Kiểm tra tính hợp lệ của transaction hash
                        if (string.IsNullOrEmpty(transaction.TransactionHash) ||
                            !transaction.TransactionHash.StartsWith("0x") ||
                            transaction.TransactionHash.Length != 66)
                        {
                            _logger.LogWarning("TransactionHash không hợp lệ: {TxHash} (độ dài: {Length}).",
                                transaction.TransactionHash, transaction.TransactionHash?.Length ?? 0);

                            await HandleInvalidHash(dbContext, transaction, stoppingToken);
                            continue;
                        }

                        // Kiểm tra trạng thái giao dịch
                        var receipt = await web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(transaction.TransactionHash);

                        if (receipt == null)
                        {
                            // Kiểm tra thời gian giao dịch, nếu quá lâu (6 giờ) thì tăng số lần thử
                            if (transaction.NgayTao.AddHours(6) < DateTime.UtcNow)
                            {
                                IncrementRetryCount(transaction);
                                transaction.NgayCapNhat = DateTime.UtcNow;

                                _logger.LogWarning("Giao dịch {TxHash} đã chờ quá 6 giờ, tăng số lần thử lên {RetryCount}",
                                    transaction.TransactionHash, GetRetryCount(transaction));

                                if (GetRetryCount(transaction) >= _maxRetryCount)
                                {
                                    await MarkTransactionAsFailed(dbContext, transaction,
                                        "Giao dịch không được xử lý sau nhiều lần thử", stoppingToken);
                                }
                                else
                                {
                                    await dbContext.SaveChangesAsync(stoppingToken);
                                }
                            }

                            // Giao dịch chưa được xử lý
                            continue;
                        }

                        transaction.BlockNumber = (long)receipt.BlockNumber.Value;
                        transaction.NgayCapNhat = DateTime.UtcNow;

                        if (receipt.Status.Value == 1) // Success
                        {
                            transaction.TrangThai = 1; // Success

                            // Xử lý sự kiện ServerDaTao nếu là giao dịch DEPLOY_SERVER
                            if (transaction.LoaiGiaoDich == "DEPLOY_SERVER" && transaction.LoaiDoiTuong == "CuocBauCu")
                            {
                                await ProcessServerDaTaoEvent(dbContext, web3, receipt, transaction, stoppingToken);
                            }
                            else
                            {
                                await dbContext.SaveChangesAsync(stoppingToken);
                            }
                        }
                        else
                        {
                            await MarkTransactionAsFailed(dbContext, transaction,
                                "Giao dịch thất bại trên blockchain", stoppingToken);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi xử lý giao dịch {TxHash}: {Error}", transaction.TransactionHash, ex.Message);

                        // Xử lý exception cho các giao dịch có vấn đề
                        if (ex.Message.Contains("invalid argument") && ex.Message.Contains("hex string"))
                        {
                            await MarkTransactionAsFailed(dbContext, transaction,
                                $"Transaction hash không hợp lệ: {ex.Message}", stoppingToken);
                        }
                        else
                        {
                            // Tăng số lần thử cho các lỗi khác
                            try
                            {
                                IncrementRetryCount(transaction);
                                transaction.NgayCapNhat = DateTime.UtcNow;

                                if (GetRetryCount(transaction) >= _maxRetryCount)
                                {
                                    await MarkTransactionAsFailed(dbContext, transaction,
                                        $"Lỗi xử lý sau {_maxRetryCount} lần thử: {ex.Message}", stoppingToken);
                                }
                                else
                                {
                                    await dbContext.SaveChangesAsync(stoppingToken);
                                }
                            }
                            catch (Exception innerEx)
                            {
                                _logger.LogError(innerEx, "Lỗi khi cập nhật số lần thử: {Error}", innerEx.Message);
                            }
                        }
                    }
                }
            }
        }

        // Phương thức xử lý hash không hợp lệ
        private async Task HandleInvalidHash(ApplicationDbContext dbContext, BlockchainTransaction transaction, CancellationToken stoppingToken)
        {
            // Thử tìm hash liên quan trong metadata
            string relatedHash = await TryExtractRelatedHashFromMetadata(transaction);

            // Nếu tìm thấy hash liên quan và hợp lệ
            if (!string.IsNullOrEmpty(relatedHash) && relatedHash.StartsWith("0x") && relatedHash.Length == 66)
            {
                _logger.LogInformation("Sử dụng hash liên quan {RelatedHash} thay thế cho hash không hợp lệ {InvalidHash}",
                    relatedHash, transaction.TransactionHash);

                // Cập nhật hash và kiểm tra ngay
                transaction.TransactionHash = relatedHash;
                await dbContext.SaveChangesAsync(stoppingToken);

                // Đánh dấu để lần chạy tiếp theo xử lý (không đánh dấu thất bại)
                return;
            }

            // Đánh dấu giao dịch thất bại do hash không hợp lệ
            await MarkTransactionAsFailed(dbContext, transaction,
                "Transaction hash không hợp lệ", stoppingToken);
        }

        // Thêm phương thức trích xuất hash liên quan từ metadata
        private async Task<string> TryExtractRelatedHashFromMetadata(BlockchainTransaction transaction)
        {
            try
            {
                if (!string.IsNullOrEmpty(transaction.MetaData))
                {
                    var metadata = System.Text.Json.JsonDocument.Parse(transaction.MetaData);

                    // Tìm kiếm các trường có thể chứa hash thực tế
                    foreach (var field in new[] { "actualTxHash", "frontendHash", "backendHash", "relatedHash" })
                    {
                        if (metadata.RootElement.TryGetProperty(field, out var hashElement))
                        {
                            var possibleHash = hashElement.GetString();
                            if (!string.IsNullOrEmpty(possibleHash) &&
                                possibleHash.StartsWith("0x") &&
                                possibleHash.Length == 66)
                            {
                                _logger.LogInformation("Tìm thấy hash liên quan {Hash} trong trường {Field}", possibleHash, field);
                                return possibleHash;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi phân tích metadata để tìm hash liên quan");
            }

            return null;
        }

        // Thêm phương thức đánh dấu giao dịch thất bại và cập nhật cuộc bầu cử tương ứng
        private async Task MarkTransactionAsFailed(
            ApplicationDbContext dbContext,
            BlockchainTransaction transaction,
            string errorMessage,
            CancellationToken stoppingToken)
        {
            try
            {
                // Cập nhật trạng thái giao dịch thành thất bại
                transaction.TrangThai = 2; // Failed
                transaction.NgayCapNhat = DateTime.UtcNow;

                // Lưu thông báo lỗi trong metadata
                SaveErrorToMetadata(transaction, errorMessage);

                // Cập nhật trạng thái cuộc bầu cử nếu cần
                if (transaction.LoaiGiaoDich == "DEPLOY_SERVER" && transaction.LoaiDoiTuong == "CuocBauCu")
                {
                    var cuocBauCu = await dbContext.CuocBauCus.FindAsync(transaction.DoiTuongId);
                    if (cuocBauCu != null && cuocBauCu.TrangThaiBlockchain == 1)
                    {
                        cuocBauCu.TrangThaiBlockchain = 6; // Lỗi
                        cuocBauCu.ErrorMessage = errorMessage;
                    }
                }

                await dbContext.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Đã đánh dấu giao dịch {TxHash} thất bại với lỗi: {Error}",
                    transaction.TransactionHash, errorMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đánh dấu giao dịch thất bại: {Error}", ex.Message);
            }
        }

        // Phương thức xử lý các giao dịch đang chờ (pending) với hash tạm thời
        private async Task ProcessPendingTransactions(CancellationToken stoppingToken)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Lấy các giao dịch có hash tạm thời, giới hạn số lượng để tránh quá tải
                var pendingTransactions = await dbContext.BlockchainTransactions
                    .Where(t => t.TransactionHash != null &&
                           t.TransactionHash.StartsWith("pending_") &&
                           t.TrangThai == 0)
                    .OrderBy(t => t.NgayTao)
                    .Take(_maxTransactionsPerRun)
                    .ToListAsync(stoppingToken);

                if (pendingTransactions.Count > 0)
                {
                    _logger.LogInformation("Tìm thấy {Count} giao dịch đang chờ xử lý với hash tạm thời", pendingTransactions.Count);
                }

                foreach (var transaction in pendingTransactions)
                {
                    // Bỏ qua nếu đã vượt quá số lần thử
                    if (GetRetryCount(transaction) >= _maxRetryCount)
                    {
                        await MarkTransactionAsFailed(dbContext, transaction,
                            "Vượt quá số lần thử tối đa", stoppingToken);
                        continue;
                    }

                    // Trích xuất thông tin từ hash tạm thời, ví dụ: pending_0xAddress_nonce_type
                    string[] parts = transaction.TransactionHash.Split('_');
                    if (parts.Length >= 3)
                    {
                        string address = parts[1];
                        string nonceStr = parts[2];

                        if (int.TryParse(nonceStr, out int nonce))
                        {
                            try
                            {
                                // Thử tìm giao dịch thực tế từ địa chỉ và nonce
                                var web3 = new Web3(_rpcUrl);
                                var txCount = await web3.Eth.Transactions.GetTransactionCount.SendRequestAsync(address);

                                // Nếu nonce đã được xử lý (nonce hiện tại > nonce giao dịch)
                                if (txCount.Value > nonce)
                                {
                                    // Tìm giao dịch thực tế
                                    var realHash = await FindRealTransactionHash(web3, address, nonce);

                                    if (!string.IsNullOrEmpty(realHash))
                                    {
                                        _logger.LogInformation("Tìm thấy hash thực tế {RealHash} cho giao dịch tạm thời {PendingHash}",
                                            realHash, transaction.TransactionHash);

                                        // Cập nhật hash thực tế và trạng thái thành công
                                        transaction.TransactionHash = realHash;
                                        transaction.TrangThai = 1; // Success - Cập nhật trạng thái thành công
                                        transaction.NgayCapNhat = DateTime.UtcNow;

                                        // Nếu là giao dịch DEPLOY_SERVER, thử xử lý ngay
                                        if (transaction.LoaiGiaoDich == "DEPLOY_SERVER" && transaction.LoaiDoiTuong == "CuocBauCu")
                                        {
                                            var receipt = await web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(realHash);
                                            if (receipt != null)
                                            {
                                                transaction.BlockNumber = (long)receipt.BlockNumber.Value;
                                                await ProcessServerDaTaoEvent(dbContext, web3, receipt, transaction, stoppingToken);
                                            }
                                            else
                                            {
                                                await dbContext.SaveChangesAsync(stoppingToken);
                                            }
                                        }
                                        else
                                        {
                                            await dbContext.SaveChangesAsync(stoppingToken);
                                        }
                                    }
                                    else
                                    {
                                        // Tăng số lần thử nếu không tìm thấy hash thực tế
                                        IncrementRetryCount(transaction);
                                        transaction.NgayCapNhat = DateTime.UtcNow;

                                        // Kiểm tra số lần thử và đánh dấu thất bại nếu cần
                                        if (GetRetryCount(transaction) >= _maxRetryCount)
                                        {
                                            await MarkTransactionAsFailed(dbContext, transaction,
                                                "Không tìm thấy hash thực tế sau nhiều lần thử", stoppingToken);
                                        }
                                        else
                                        {
                                            await dbContext.SaveChangesAsync(stoppingToken);
                                        }
                                    }
                                }
                                else
                                {
                                    // Kiểm tra thời gian chờ, nếu quá lâu (6 giờ) thì tăng số lần thử
                                    if (transaction.NgayTao.AddHours(6) < DateTime.UtcNow)
                                    {
                                        IncrementRetryCount(transaction);
                                        transaction.NgayCapNhat = DateTime.UtcNow;

                                        if (GetRetryCount(transaction) >= _maxRetryCount)
                                        {
                                            await MarkTransactionAsFailed(dbContext, transaction,
                                                "Nonce chưa được xử lý sau nhiều lần thử", stoppingToken);
                                        }
                                        else
                                        {
                                            await dbContext.SaveChangesAsync(stoppingToken);
                                        }
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Lỗi khi tìm hash thực tế cho giao dịch tạm thời: {Hash}", transaction.TransactionHash);

                                // Tăng số lần thử cho các lỗi
                                IncrementRetryCount(transaction);
                                transaction.NgayCapNhat = DateTime.UtcNow;

                                if (GetRetryCount(transaction) >= _maxRetryCount)
                                {
                                    await MarkTransactionAsFailed(dbContext, transaction,
                                        $"Lỗi khi tìm hash thực tế: {ex.Message}", stoppingToken);
                                }
                                else
                                {
                                    await dbContext.SaveChangesAsync(stoppingToken);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Phương thức tìm hash thực tế từ địa chỉ và nonce
        private async Task<string> FindRealTransactionHash(Web3 web3, string address, int nonce)
        {
            try
            {
                // Lấy block hiện tại
                var currentBlock = await web3.Eth.Blocks.GetBlockNumber.SendRequestAsync();

                // Tìm kiếm qua các block gần đây (giới hạn block được cấu hình)
                long startBlock = Math.Max(0, (long)currentBlock.Value - _searchBlockRange);

                _logger.LogInformation("Tìm kiếm hash thực tế cho {Address} với nonce {Nonce} từ block {StartBlock} đến {EndBlock}",
                    address, nonce, startBlock, currentBlock.Value);

                for (long i = (long)currentBlock.Value; i >= startBlock; i--)
                {
                    try
                    {
                        var block = await web3.Eth.Blocks.GetBlockWithTransactionsByNumber.SendRequestAsync(new HexBigInteger(i));

                        if (block?.Transactions != null)
                        {
                            foreach (var tx in block.Transactions)
                            {
                                if (tx.From.ToLower() == address.ToLower() && tx.Nonce.Value == nonce)
                                {
                                    _logger.LogInformation("Tìm thấy hash {Hash} trong block {Block} cho nonce {Nonce}",
                                        tx.TransactionHash, i, nonce);
                                    return tx.TransactionHash;
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Lỗi khi lấy block {BlockNumber}: {Error}", i, ex.Message);
                        continue; // Bỏ qua block này, tiếp tục với block tiếp theo
                    }
                }

                _logger.LogWarning("Không tìm thấy hash thực tế cho {Address} với nonce {Nonce} trong {BlockRange} block gần đây",
                    address, nonce, _searchBlockRange);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tìm kiếm giao dịch từ địa chỉ {Address} với nonce {Nonce}", address, nonce);
            }

            return null;
        }

        // Phương thức khôi phục các giao dịch DEPLOY_SERVER không có hash hợp lệ
        private async Task RecoverDeployTransactions(CancellationToken stoppingToken)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Chỉ khôi phục các giao dịch trong khoảng thời gian quy định
                var cutoffTime = DateTime.UtcNow.AddHours(-_recoverTransactionsOlderThanHours);

                // Lấy các cuộc bầu cử đã triển khai lên blockchain (TrangThaiBlockchain = 2)
                // nhưng giao dịch DEPLOY_SERVER tương ứng có vấn đề với hash
                var problemElections = await dbContext.CuocBauCus
                    .Where(c => c.TrangThaiBlockchain == 2 &&
                          (c.BlockchainServerId == null || c.BlockchainServerId == 0) &&
                          c.BlockchainAddress != null &&
                          c.NgayBatDau >= cutoffTime)
                    .Take(_maxTransactionsPerRun)
                    .ToListAsync(stoppingToken);

                if (problemElections.Count > 0)
                {
                    _logger.LogInformation("Tìm thấy {Count} cuộc bầu cử cần khôi phục giao dịch triển khai",
                        problemElections.Count);
                }

                foreach (var election in problemElections)
                {
                    try
                    {
                        // Tìm giao dịch DEPLOY_SERVER cho cuộc bầu cử này
                        var transaction = await dbContext.BlockchainTransactions
                            .Where(t => t.LoaiGiaoDich == "DEPLOY_SERVER" &&
                                   t.LoaiDoiTuong == "CuocBauCu" &&
                                   t.DoiTuongId == election.Id)
                            .FirstOrDefaultAsync(stoppingToken);

                        if (transaction != null)
                        {
                            // Kiểm tra hash có vấn đề
                            bool hashProblem = string.IsNullOrEmpty(transaction.TransactionHash) ||
                                              transaction.TransactionHash.StartsWith("pending_") ||
                                              !transaction.TransactionHash.StartsWith("0x") ||
                                              transaction.TransactionHash.Length != 66;

                            if (hashProblem)
                            {
                                // Tìm và cập nhật hash thực tế dựa trên địa chỉ contract (nếu có)
                                if (!string.IsNullOrEmpty(election.BlockchainAddress))
                                {
                                    var web3 = new Web3(_rpcUrl);

                                    // Tìm sự kiện ServerDaTao từ Factory để tìm transaction hash
                                    var deployHash = await FindDeployTransactionByAddress(web3, election.BlockchainAddress);

                                    if (!string.IsNullOrEmpty(deployHash))
                                    {
                                        _logger.LogInformation("Tìm thấy hash triển khai {Hash} cho cuộc bầu cử {Id}",
                                            deployHash, election.Id);

                                        // Cập nhật hash và trạng thái
                                        transaction.TransactionHash = deployHash;
                                        transaction.TrangThai = 1; // Success
                                        transaction.NgayCapNhat = DateTime.UtcNow;

                                        // Lấy receipt để cập nhật thông tin
                                        var receipt = await web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(deployHash);
                                        if (receipt != null)
                                        {
                                            transaction.BlockNumber = (long)receipt.BlockNumber.Value;
                                        }

                                        await dbContext.SaveChangesAsync(stoppingToken);
                                    }
                                    else
                                    {
                                        // Tăng số lần thử nếu không tìm thấy hash
                                        IncrementRetryCount(transaction);
                                        transaction.NgayCapNhat = DateTime.UtcNow;

                                        if (GetRetryCount(transaction) >= _maxRetryCount)
                                        {
                                            await MarkTransactionAsFailed(dbContext, transaction,
                                                "Không tìm thấy hash triển khai sau nhiều lần thử", stoppingToken);
                                        }
                                        else
                                        {
                                            await dbContext.SaveChangesAsync(stoppingToken);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi khôi phục giao dịch triển khai cho cuộc bầu cử: {Id}", election.Id);
                    }
                }
            }
        }

        // Tìm transaction hash từ địa chỉ contract đã triển khai
        // Tìm transaction hash từ địa chỉ contract đã triển khai
        private async Task<string> FindDeployTransactionByAddress(Web3 web3, string contractAddress)
        {
            try
            {
                // Lấy block hiện tại
                var currentBlock = await web3.Eth.Blocks.GetBlockNumber.SendRequestAsync();

                // Giảm số lượng block cần tìm kiếm xuống 1000 (thay vì 10000)
                int searchRange = 1000;
                long startBlock = Math.Max(0, (long)currentBlock.Value - searchRange);

                _logger.LogInformation("Tìm kiếm hash triển khai cho địa chỉ {ContractAddress} từ block {StartBlock} đến {EndBlock}",
                    contractAddress, startBlock, currentBlock.Value);

                // Phương pháp 1: Tạo filter để tìm sự kiện ServerDaTao từ Factory
                try
                {
                    var eventHandler = web3.Eth.GetEvent<ServerDaTaoEventDTO>(_factoryAddress);
                    var filter = eventHandler.CreateFilterInput(
                        new BlockParameter(new HexBigInteger(startBlock)),
                        new BlockParameter(currentBlock));

                    // Lọc theo chủ đề địa chỉ contract (gom tất cả logs)
                    var logs = await web3.Eth.Filters.GetLogs.SendRequestAsync(filter);

                    // Fix the logs.Count issue by using Count() method
                    _logger.LogInformation("Tìm thấy {Count} logs từ factory contract", logs.Count());

                    foreach (var log in logs)
                    {
                        try
                        {
                            // Skip DecodeEvent if log is not FilterLog type
                            if (log is Nethereum.RPC.Eth.DTOs.FilterLog filterLog)
                            {
                                try
                                {
                                    var decodedEvent = Event<ServerDaTaoEventDTO>.DecodeEvent(filterLog);
                                    if (decodedEvent?.Event != null &&
                                        string.Equals(decodedEvent.Event.QuanLyCuocBauCu?.ToLower(), contractAddress.ToLower(), StringComparison.OrdinalIgnoreCase))
                                    {
                                        string txHash = GetTransactionHash(log);
                                        _logger.LogInformation("Tìm thấy hash {Hash} cho địa chỉ contract {Address} từ sự kiện",
                                            txHash, contractAddress);
                                        return txHash;
                                    }
                                }
                                catch (Exception decodeEx)
                                {
                                    _logger.LogDebug(decodeEx, "Không thể giải mã log, thử phương pháp thay thế");
                                }
                            }

                            // Always try the manual approach using helper methods
                            string logAddress = GetLogAddress(log);
                            List<string> topics = GetLogTopics(log);

                            if (string.Equals(logAddress?.ToLower(), _factoryAddress.ToLower(), StringComparison.OrdinalIgnoreCase) &&
                                topics.Count >= 3)
                            {
                                // Giải mã địa chỉ từ topic (topic[2] là địa chỉ quanLyCuocBauCu)
                                string addressFromTopic = "0x" + topics[2].Substring(26);
                                if (string.Equals(addressFromTopic.ToLower(), contractAddress.ToLower(), StringComparison.OrdinalIgnoreCase))
                                {
                                    string txHash = GetTransactionHash(log);
                                    _logger.LogInformation("Tìm thấy hash {Hash} cho địa chỉ contract {Address} từ topics",
                                        txHash, contractAddress);
                                    return txHash;
                                }
                            }

                            // Kiểm tra trong dữ liệu log
                            string logData = GetLogData(log);
                            if (!string.IsNullOrEmpty(logData) &&
                                logData.IndexOf(contractAddress.TrimStart('0', 'x'), StringComparison.OrdinalIgnoreCase) >= 0)
                            {
                                string txHash = GetTransactionHash(log);
                                _logger.LogInformation("Tìm thấy hash {Hash} cho địa chỉ contract {Address} từ dữ liệu log",
                                    txHash, contractAddress);
                                return txHash;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogDebug(ex, "Lỗi khi kiểm tra log thủ công");
                        }
                    }

                    _logger.LogWarning("Không tìm thấy hash triển khai cho địa chỉ {ContractAddress} trong {BlockRange} block gần đây",
                        contractAddress, searchRange);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi tìm sự kiện ServerDaTao: {Error}", ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tìm giao dịch triển khai cho địa chỉ contract: {Address}", contractAddress);
            }

            return null;
        }


        // Fix the ProcessServerDaTaoEvent method to handle different log types
        // Fix the ProcessServerDaTaoEvent method to handle different log types
        private async Task ProcessServerDaTaoEvent(
    ApplicationDbContext dbContext,
    Web3 web3,
    TransactionReceipt receipt,
    BlockchainTransaction transaction,
    CancellationToken stoppingToken)
        {
            try
            {
                _logger.LogInformation("Xử lý sự kiện ServerDaTao cho TX: {TxHash}, DoiTuongId: {Id}",
                    transaction.TransactionHash, transaction.DoiTuongId);

                // Kiểm tra xem cuộc bầu cử đã được cập nhật thông tin blockchain chưa
                var cuocBauCu = await dbContext.CuocBauCus.FindAsync(transaction.DoiTuongId);
                if (cuocBauCu == null)
                {
                    _logger.LogWarning("Không tìm thấy cuộc bầu cử với ID: {Id}", transaction.DoiTuongId);
                    return;
                }

                // Nếu cuộc bầu cử đã có BlockchainServerId, không cần xử lý tiếp
                if (cuocBauCu.BlockchainServerId != null && cuocBauCu.BlockchainServerId > 0 &&
                    !string.IsNullOrEmpty(cuocBauCu.BlockchainAddress) && cuocBauCu.TrangThaiBlockchain == 2)
                {
                    _logger.LogInformation("Cuộc bầu cử đã có thông tin blockchain, không cần xử lý lại. ServerId: {ServerId}, Address: {Address}",
                        cuocBauCu.BlockchainServerId, cuocBauCu.BlockchainAddress);
                    return;
                }

                // Tạo event handler với DTO
                var eventHandler = web3.Eth.GetEvent<ServerDaTaoEventDTO>(_factoryAddress);

                // Giải mã tất cả các sự kiện từ receipt.Logs
                ServerDaTaoEventDTO foundEvent = null;
                try
                {
                    // Phương pháp 1: DecodeAllEventsForEvent (cách đơn giản nhất)
                    var eventLogs = eventHandler.DecodeAllEventsForEvent(receipt.Logs);
                    if (eventLogs != null && eventLogs.Count > 0)
                    {
                        foundEvent = eventLogs[0].Event;
                        _logger.LogInformation("Tìm thấy sự kiện ServerDaTao bằng phương pháp DecodeAllEventsForEvent");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Không thể giải mã sự kiện bằng phương pháp 1: {Error}", ex.Message);

                    // Phương pháp 2: Lọc logs và giải mã từng log
                    try
                    {
                        // Lọc logs từ địa chỉ factory
                        var factoryLogs = receipt.Logs
                            .Where(log => string.Equals(GetLogAddress(log)?.ToLower(),
                                                      _factoryAddress.ToLower(),
                                                      StringComparison.OrdinalIgnoreCase))
                            .ToList();

                        _logger.LogInformation("Tìm thấy {Count} logs từ địa chỉ factory", factoryLogs.Count);

                        foreach (var log in factoryLogs)
                        {
                            try
                            {
                                // Không sử dụng ép kiểu trực tiếp, thay vào đó serialize và deserialize
                                string logJson = JsonConvert.SerializeObject(log);
                                var filterLog = JsonConvert.DeserializeObject<FilterLog>(logJson);

                                if (filterLog != null)
                                {
                                    var eventLog = Event<ServerDaTaoEventDTO>.DecodeEvent(filterLog);
                                    if (eventLog?.Event != null)
                                    {
                                        foundEvent = eventLog.Event;
                                        _logger.LogInformation("Tìm thấy sự kiện ServerDaTao bằng phương pháp JSON convert");
                                        break;
                                    }
                                }
                            }
                            catch (Exception logEx)
                            {
                                _logger.LogDebug(logEx, "Không thể giải mã log: {Error}", logEx.Message);
                            }
                        }
                    }
                    catch (Exception ex2)
                    {
                        _logger.LogWarning(ex2, "Không thể giải mã sự kiện bằng phương pháp 2: {Error}", ex2.Message);
                    }
                }

                // Nếu không tìm thấy sự kiện, sử dụng phương pháp 3: lấy từ thông tin cuộc bầu cử
                if (foundEvent == null && !string.IsNullOrEmpty(cuocBauCu.BlockchainAddress))
                {
                    _logger.LogInformation("Sử dụng BlockchainAddress đã có: {Address}", cuocBauCu.BlockchainAddress);

                    // Tìm kiếm BlockchainServerId từ Factory nếu chưa có
                    long blockchainServerId = cuocBauCu.BlockchainServerId ?? 0;
                    if (blockchainServerId == 0)
                    {
                        try
                        {
                            var factoryContract = web3.Eth.GetContract(
                                "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"address\",\"type\":\"address\"}],\"name\":\"layThongTinServerTuDiaChi\",\"outputs\":[{\"internalType\":\"uint128\",\"name\":\"\",\"type\":\"uint128\"},{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"},{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"},{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
                                _factoryAddress);

                            var layThongTinFunction = factoryContract.GetFunction("layThongTinServerTuDiaChi");
                            var result = await layThongTinFunction.CallAsync<object[]>(cuocBauCu.BlockchainAddress);

                            if (result != null && result.Length > 0 && result[0] is BigInteger)
                            {
                                blockchainServerId = (long)(BigInteger)result[0];
                                _logger.LogInformation("Tìm thấy BlockchainServerId từ Factory: {Id}", blockchainServerId);
                            }
                        }
                        catch (Exception factoryEx)
                        {
                            _logger.LogWarning(factoryEx, "Lỗi khi gọi Factory để lấy thông tin server: {Error}", factoryEx.Message);
                        }
                    }

                    if (blockchainServerId > 0)
                    {
                        foundEvent = new ServerDaTaoEventDTO
                        {
                            Id = blockchainServerId,
                            QuanLyCuocBauCu = cuocBauCu.BlockchainAddress,
                            NguoiTao = null, // Không biết người tạo
                            TenCuocBauCu = cuocBauCu.TenCuocBauCu
                        };
                    }
                }

                // Xử lý dữ liệu sự kiện nếu tìm thấy
                if (foundEvent != null)
                {
                    // Lấy dữ liệu từ event
                    var blockchainServerId = (long)foundEvent.Id;
                    var serverAddress = foundEvent.QuanLyCuocBauCu;
                    var tenCuocBauCu = foundEvent.TenCuocBauCu;

                    _logger.LogInformation("Sự kiện ServerDaTao: ID: {ID}, Address: {Address}, Tên: {Ten}",
                        blockchainServerId, serverAddress, tenCuocBauCu);

                    // Mở rộng điều kiện cập nhật
                    bool shouldUpdate = cuocBauCu.TrangThaiBlockchain == 1 ||
                                      cuocBauCu.BlockchainServerId == null ||
                                      cuocBauCu.BlockchainServerId == 0 ||
                                      string.IsNullOrEmpty(cuocBauCu.BlockchainAddress);

                    if (shouldUpdate)
                    {
                        _logger.LogInformation("Cập nhật BlockchainServerId: {Id} và BlockchainAddress: {Address} cho cuộc bầu cử ID: {CuocBauCuId}",
                            blockchainServerId, serverAddress, cuocBauCu.Id);

                        cuocBauCu.BlockchainServerId = blockchainServerId;
                        cuocBauCu.BlockchainAddress = serverAddress;

                        if (cuocBauCu.TrangThaiBlockchain == 1)
                        {
                            cuocBauCu.TrangThaiBlockchain = 2; // Đã triển khai
                            cuocBauCu.ErrorMessage = null; // Xóa thông báo lỗi nếu có
                            _logger.LogInformation("Đã cập nhật trạng thái cuộc bầu cử: 1 -> 2 (Đã triển khai)");
                        }

                        await dbContext.SaveChangesAsync(stoppingToken);

                        _logger.LogInformation("Đã cập nhật thành công thông tin blockchain cho cuộc bầu cử ID: {Id}",
                            cuocBauCu.Id);
                    }
                    else
                    {
                        _logger.LogInformation("Không cần cập nhật thông tin blockchain cho cuộc bầu cử ID: {Id}",
                            cuocBauCu.Id);
                    }
                }
                else
                {
                    _logger.LogWarning("Không tìm thấy sự kiện ServerDaTao trong giao dịch {TxHash}", transaction.TransactionHash);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý sự kiện ServerDaTao: {Error}", ex.Message);
            }
        }




        // Phương thức chuyển đổi chuỗi hex thành mảng byte
        private byte[] HexStringToByteArray(string hex)
        {
            if (hex.StartsWith("0x"))
                hex = hex.Substring(2);

            int numberChars = hex.Length;
            byte[] bytes = new byte[numberChars / 2];

            for (int i = 0; i < numberChars; i += 2)
            {
                bytes[i / 2] = Convert.ToByte(hex.Substring(i, 2), 16);
            }

            return bytes;
        }

        // Tách phần xử lý dữ liệu sự kiện thành phương thức riêng
        private async Task ProcessServerDaTaoEventData(
            ApplicationDbContext dbContext,
            ServerDaTaoEventDTO eventData,
            BlockchainTransaction transaction,
            CancellationToken stoppingToken)
        {
            // Lấy dữ liệu từ event
            var blockchainServerId = (long)eventData.Id;
            var serverAddress = eventData.QuanLyCuocBauCu;
            var tenCuocBauCu = eventData.TenCuocBauCu;

            _logger.LogInformation("Sự kiện ServerDaTao: ID: {ID}, Address: {Address}, Tên: {Ten}",
                blockchainServerId, serverAddress, tenCuocBauCu);

            // Cập nhật thông tin cuộc bầu cử
            var cuocBauCu = await dbContext.CuocBauCus.FindAsync(transaction.DoiTuongId);

            if (cuocBauCu == null)
            {
                _logger.LogWarning("Không tìm thấy cuộc bầu cử với ID: {Id}", transaction.DoiTuongId);
                return;
            }

            _logger.LogInformation("Tìm thấy cuộc bầu cử ID: {Id}, TrangThai: {TrangThai}, ServerId: {ServerId}",
                cuocBauCu.Id, cuocBauCu.TrangThaiBlockchain, cuocBauCu.BlockchainServerId);

            // Mở rộng điều kiện cập nhật
            bool shouldUpdate = cuocBauCu.TrangThaiBlockchain == 1 ||
                              cuocBauCu.BlockchainServerId == null ||
                              cuocBauCu.BlockchainServerId == 0 ||
                              string.IsNullOrEmpty(cuocBauCu.BlockchainAddress);

            if (shouldUpdate)
            {
                _logger.LogInformation("Cập nhật BlockchainServerId: {Id} và BlockchainAddress: {Address} cho cuộc bầu cử ID: {CuocBauCuId}",
                    blockchainServerId, serverAddress, cuocBauCu.Id);

                cuocBauCu.BlockchainServerId = blockchainServerId;
                cuocBauCu.BlockchainAddress = serverAddress;

                if (cuocBauCu.TrangThaiBlockchain == 1)
                {
                    cuocBauCu.TrangThaiBlockchain = 2; // Đã triển khai
                    cuocBauCu.ErrorMessage = null; // Xóa thông báo lỗi nếu có
                    _logger.LogInformation("Đã cập nhật trạng thái cuộc bầu cử: 1 -> 2 (Đã triển khai)");
                }

                await dbContext.SaveChangesAsync(stoppingToken);

                _logger.LogInformation("Đã cập nhật thành công thông tin blockchain cho cuộc bầu cử ID: {Id}",
                    cuocBauCu.Id);
            }
            else
            {
                _logger.LogInformation("Không cần cập nhật thông tin blockchain cho cuộc bầu cử ID: {Id}",
                    cuocBauCu.Id);
            }
        }

        // Các phương thức lưu trữ số lần thử thông qua MetaData
        private int GetRetryCount(BlockchainTransaction transaction)
        {
            try
            {
                if (string.IsNullOrEmpty(transaction.MetaData))
                {
                    return 0;
                }

                var metadata = ParseMetadata(transaction);
                if (metadata.TryGetValue("retryCount", out var value))
                {
                    if (value is int intValue)
                    {
                        return intValue;
                    }
                    else if (value is long longValue)
                    {
                        return (int)longValue;
                    }
                    else if (value != null)
                    {
                        // Thử chuyển đổi từ bất kỳ loại nào thành int
                        if (int.TryParse(value.ToString(), out int parsedValue))
                        {
                            return parsedValue;
                        }
                    }
                }
            }
            catch
            {
                // Nếu có lỗi, trả về 0
            }

            return 0;
        }

        private void IncrementRetryCount(BlockchainTransaction transaction)
        {
            try
            {
                var metadata = ParseMetadata(transaction);
                int currentCount = 0;

                if (metadata.TryGetValue("retryCount", out var value))
                {
                    if (value is int intValue)
                    {
                        currentCount = intValue;
                    }
                    else if (value is long longValue)
                    {
                        currentCount = (int)longValue;
                    }
                    else if (value != null)
                    {
                        // Thử chuyển đổi từ bất kỳ loại nào thành int
                        if (int.TryParse(value.ToString(), out int parsedValue))
                        {
                            currentCount = parsedValue;
                        }
                    }
                }

                metadata["retryCount"] = currentCount + 1;
                transaction.MetaData = JsonConvert.SerializeObject(metadata);

                _logger.LogInformation("Đã tăng số lần thử cho giao dịch {TxHash} lên {RetryCount}",
                    transaction.TransactionHash, currentCount + 1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tăng số lần thử cho giao dịch");
            }
        }

        



        private void SaveErrorToMetadata(BlockchainTransaction transaction, string errorMessage)
        {
            try
            {
                var metadata = ParseMetadata(transaction);
                metadata["errorMessage"] = errorMessage;
                metadata["errorTimestamp"] = DateTime.UtcNow.ToString("o");
                transaction.MetaData = JsonConvert.SerializeObject(metadata);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lưu thông báo lỗi vào metadata");
            }
        }

        private Dictionary<string, object> ParseMetadata(BlockchainTransaction transaction)
        {
            var metadata = new Dictionary<string, object>();

            if (!string.IsNullOrEmpty(transaction.MetaData))
            {
                try
                {
                    metadata = JsonConvert.DeserializeObject<Dictionary<string, object>>(transaction.MetaData);
                }
                catch
                {
                    // Nếu không thể parse, khởi tạo metadata mới
                }
            }

            if (metadata == null)
            {
                metadata = new Dictionary<string, object>();
            }

            return metadata;
        }

        // Các phương thức trợ giúp giữ nguyên
        private string GetTransactionHash(object log)
        {
            try
            {
                // Truy cập theo kiểu đối tượng
                Type logType = log.GetType();

                if (logType.Name.Contains("JToken") || logType.FullName.Contains("Newtonsoft.Json.Linq"))
                {
                    // Xử lý JToken
                    dynamic dynamicLog = log;
                    return dynamicLog["transactionHash"]?.ToString();
                }
                else if (logType.Name.Contains("FilterLog") || logType.FullName.Contains("Nethereum.RPC.Eth.DTOs"))
                {
                    // Xử lý FilterLog
                    dynamic dynamicLog = log;
                    return dynamicLog.TransactionHash;
                }
                else
                {
                    // Thử dùng reflection cho các kiểu khác
                    var property = logType.GetProperty("TransactionHash");
                    if (property != null)
                    {
                        return property.GetValue(log)?.ToString();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy TransactionHash từ log kiểu {LogType}", log?.GetType().Name);
            }

            return null;
        }

        private string GetLogAddress(object log)
        {
            try
            {
                // Truy cập theo kiểu đối tượng
                Type logType = log.GetType();

                if (logType.Name.Contains("JToken") || logType.FullName.Contains("Newtonsoft.Json.Linq"))
                {
                    // Xử lý JToken
                    dynamic dynamicLog = log;
                    return dynamicLog["address"]?.ToString();
                }
                else if (logType.Name.Contains("FilterLog") || logType.FullName.Contains("Nethereum.RPC.Eth.DTOs"))
                {
                    // Xử lý FilterLog
                    dynamic dynamicLog = log;
                    return dynamicLog.Address;
                }
                else
                {
                    // Thử dùng reflection cho các kiểu khác
                    var property = logType.GetProperty("Address");
                    if (property != null)
                    {
                        return property.GetValue(log)?.ToString();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy Address từ log kiểu {LogType}", log?.GetType().Name);
            }

            return null;
        }

        private List<string> GetLogTopics(object log)
        {
            var result = new List<string>();

            try
            {
                // Truy cập theo kiểu đối tượng
                Type logType = log.GetType();

                if (logType.Name.Contains("JToken") || logType.FullName.Contains("Newtonsoft.Json.Linq"))
                {
                    // Xử lý JToken
                    dynamic dynamicLog = log;
                    var topicsArray = dynamicLog["topics"];
                    if (topicsArray != null)
                    {
                        foreach (var topic in topicsArray)
                        {
                            result.Add(topic.ToString());
                        }
                    }
                }
                else if (logType.Name.Contains("FilterLog") || logType.FullName.Contains("Nethereum.RPC.Eth.DTOs"))
                {
                    // Xử lý FilterLog
                    dynamic dynamicLog = log;
                    var topics = dynamicLog.Topics;
                    if (topics != null)
                    {
                        foreach (var topic in topics)
                        {
                            result.Add(topic.ToString());
                        }
                    }
                }
                else
                {
                    // Thử dùng reflection cho các kiểu khác
                    var property = logType.GetProperty("Topics");
                    if (property != null)
                    {
                        var topics = property.GetValue(log);
                        if (topics is System.Collections.IEnumerable enumerable)
                        {
                            foreach (var topic in enumerable)
                            {
                                result.Add(topic.ToString());
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy Topics từ log kiểu {LogType}", log?.GetType().Name);
            }

            return result;
        }

        private string GetLogData(object log)
        {
            try
            {
                // Truy cập theo kiểu đối tượng
                Type logType = log.GetType();

                if (logType.Name.Contains("JToken") || logType.FullName.Contains("Newtonsoft.Json.Linq"))
                {
                    // Xử lý JToken
                    dynamic dynamicLog = log;
                    return dynamicLog["data"]?.ToString();
                }
                else if (logType.Name.Contains("FilterLog") || logType.FullName.Contains("Nethereum.RPC.Eth.DTOs"))
                {
                    // Xử lý FilterLog
                    dynamic dynamicLog = log;
                    return dynamicLog.Data;
                }
                else
                {
                    // Thử dùng reflection cho các kiểu khác
                    var property = logType.GetProperty("Data");
                    if (property != null)
                    {
                        return property.GetValue(log)?.ToString();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy Data từ log kiểu {LogType}", log?.GetType().Name);
            }

            return null;
        }

        // Lớp mô tả ServerDaTao event
        [Event("ServerDaTao")]
        public class ServerDaTaoEventDTO : IEventDTO
        {
            [Parameter("uint128", "id", 1, true)]
            public virtual BigInteger Id { get; set; }

            [Parameter("address", "quanLyCuocBauCu", 2, true)]
            public virtual string QuanLyCuocBauCu { get; set; }

            [Parameter("address", "nguoiTao", 3, true)]
            public virtual string NguoiTao { get; set; }

            [Parameter("string", "tenCuocBauCu", 4, false)]
            public virtual string TenCuocBauCu { get; set; }
        }
    }
}