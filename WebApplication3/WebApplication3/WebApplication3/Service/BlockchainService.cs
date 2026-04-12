using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nethereum.Web3;
using Nethereum.Contracts;
using Nethereum.Hex.HexTypes;
using Nethereum.Util;
using System;
using System.Threading.Tasks;
using Nethereum.Hex.HexConvertors.Extensions;
using WebApplication3.Contracts;
using System.Numerics;
using Microsoft.Extensions.DependencyInjection;
using Nethereum.RPC.Eth.DTOs;

namespace WebApplication3.Services
{
    public class BlockchainService
    {
        private readonly string _rpcUrl;
        private readonly string _adminPrivateKey;
        private readonly string _adminPrivateKey2;
        private readonly IConfiguration _configuration;
        private readonly ILogger<BlockchainService> _logger;
        private readonly IServiceProvider _serviceProvider;

        public BlockchainService(
            IConfiguration configuration,
            ILogger<BlockchainService> logger,
            IServiceProvider serviceProvider)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));

            _rpcUrl = _configuration["BlockchainSettings:RpcUrl"];
            if (string.IsNullOrEmpty(_rpcUrl))
            {
                _logger.LogError("RPC URL không được cấu hình trong appsettings.json.");
                throw new ArgumentNullException(nameof(_rpcUrl));
            }

            _adminPrivateKey = _configuration["BlockchainSettings:AdminPrivateKey"];
            _adminPrivateKey2 = _configuration["BlockchainSettings:AdminPrivateKey2"];

            if (string.IsNullOrEmpty(_adminPrivateKey))
            {
                _logger.LogError("Admin Private Key không được cấu hình trong appsettings.json.");
                throw new ArgumentNullException(nameof(_adminPrivateKey));
            }

            _logger.LogInformation("BlockchainService khởi tạo thành công với RpcUrl: {RpcUrl}", _rpcUrl);
        }

        private SessionService GetSessionService()
        {
            return _serviceProvider.GetRequiredService<SessionService>();
        }

        public async Task<bool> CheckSCWExists(string scwAddress)
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(scwAddress))
            {
                _logger.LogError("Địa chỉ SCW không hợp lệ: {ScwAddress}", scwAddress);
                throw new ArgumentException("Địa chỉ SCW không hợp lệ.");
            }

            var web3 = new Web3(_rpcUrl);
            var code = await web3.Eth.GetCode.SendRequestAsync(scwAddress);
            bool exists = !string.IsNullOrEmpty(code) && code != "0x";
            _logger.LogInformation("Kiểm tra SCW {ScwAddress}: {Exists}", scwAddress, exists);
            return exists;
        }

        public async Task<decimal> GetTokenBalance(string scwAddress)
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(scwAddress))
            {
                _logger.LogError("Địa chỉ SCW không hợp lệ: {ScwAddress}", scwAddress);
                throw new ArgumentException("Địa chỉ SCW không hợp lệ.");
            }

            var hluTokenAddress = _configuration["BlockchainSettings:ContractAddresses:HoLiHuToken"];
            if (string.IsNullOrEmpty(hluTokenAddress))
            {
                _logger.LogError("Địa chỉ HoLiHuToken không được cấu hình.");
                throw new ArgumentNullException(nameof(hluTokenAddress));
            }

            var web3 = new Web3(_rpcUrl);
            var tokenContract = web3.Eth.GetContract(ContractABIs.HoLiHuToken, hluTokenAddress);
            var balanceFunction = tokenContract.GetFunction("balanceOf");
            var balance = await balanceFunction.CallAsync<BigInteger>(scwAddress);
            decimal balanceInEther = UnitConversion.Convert.FromWei(balance, 18);
            _logger.LogInformation("Số dư token của {ScwAddress}: {Balance}", scwAddress, balanceInEther);
            return balanceInEther;
        }

        public async Task<string> DeploySimpleAccount(string eoaAddress, string salt)
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(eoaAddress))
            {
                _logger.LogError("Địa chỉ EOA không hợp lệ: {EoaAddress}", eoaAddress);
                throw new ArgumentException("Địa chỉ EOA không hợp lệ.");
            }

            var factoryAddress = _configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
            if (string.IsNullOrEmpty(factoryAddress))
            {
                _logger.LogError("Địa chỉ CuocBauCuFactory không được cấu hình.");
                throw new ArgumentNullException(nameof(factoryAddress));
            }

            var adminAccount = new Nethereum.Web3.Accounts.Account(_adminPrivateKey);
            var adminAddress = adminAccount.Address;

            var web3 = new Web3(adminAccount, _rpcUrl);
            var factoryContract = web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, factoryAddress);
            var deployFunction = factoryContract.GetFunction("taoSimpleAccountTrucTiep");

            var predictedAddress = await PredictSCWAddress(factoryAddress, adminAddress, salt);
            var existingCode = await web3.Eth.GetCode.SendRequestAsync(predictedAddress);
            if (!string.IsNullOrEmpty(existingCode) && existingCode != "0x")
            {
                _logger.LogInformation("SCW đã tồn tại tại địa chỉ: {PredictedAddress}", predictedAddress);
                return predictedAddress;
            }

            try
            {
                var gasEstimate = await deployFunction.EstimateGasAsync(
                    adminAddress,
                    new HexBigInteger(2000000),
                    new HexBigInteger(0),
                    salt.HexToByteArray(),
                    adminAddress
                );
                var gasPrice = await web3.Eth.GasPrice.SendRequestAsync();

                var txHash = await deployFunction.SendTransactionAsync(
                    adminAddress,
                    gasEstimate.Value > 0 ? gasEstimate : new HexBigInteger(2000000),
                    gasPrice,
                    new HexBigInteger(0),
                    salt.HexToByteArray(),
                    adminAddress
                );

                var receipt = await web3.TransactionManager.TransactionReceiptService.PollForReceiptAsync(txHash, new CancellationTokenSource(TimeSpan.FromSeconds(60)).Token);
                if (receipt == null || receipt.Status.Value != 1)
                {
                    _logger.LogError("Tạo SCW thất bại. TxHash: {TxHash}", txHash);
                    throw new Exception($"Tạo SCW thất bại! TxHash: {txHash}");
                }

                _logger.LogInformation("Tạo SCW thành công. TxHash: {TxHash}, Địa chỉ: {PredictedAddress}", txHash, predictedAddress);

                try
                {
                    decimal minRequiredBalance = 10M;
                    decimal tokenBalance = await GetTokenBalance(predictedAddress);
                    if (tokenBalance < minRequiredBalance)
                    {
                        decimal amountToMint = minRequiredBalance - tokenBalance;
                        await MintInitialTokens(predictedAddress, amountToMint.ToString());
                        _logger.LogInformation("Đã mint {Amount} token thành công cho {PredictedAddress}", amountToMint, predictedAddress);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Lỗi khi mint token cho SCW {PredictedAddress}", predictedAddress);
                }

                return predictedAddress;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi triển khai SCW: {Message}", ex.Message);
                throw;
            }
        }

        public async Task MintInitialTokens(string scwAddress, string amount)
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(scwAddress))
            {
                _logger.LogError("Địa chỉ SCW không hợp lệ: {ScwAddress}", scwAddress);
                throw new ArgumentException("Địa chỉ SCW không hợp lệ.");
            }

            var hluTokenAddress = _configuration["BlockchainSettings:ContractAddresses:HoLiHuToken"];
            if (string.IsNullOrEmpty(hluTokenAddress))
            {
                _logger.LogError("Địa chỉ HoLiHuToken không được cấu hình.");
                throw new ArgumentNullException(nameof(hluTokenAddress));
            }

            var web3 = new Web3(new Nethereum.Web3.Accounts.Account(_adminPrivateKey2), _rpcUrl);

            // PHẦN 1: MINT HLU TOKEN
            try
            {
                var tokenContract = web3.Eth.GetContract(ContractABIs.HoLiHuToken, hluTokenAddress);
                var mintFunction = tokenContract.GetFunction("mint");
                var amountInWei = UnitConversion.Convert.ToWei(decimal.Parse(amount), 18);
                var txHash = await mintFunction.SendTransactionAsync(
                    web3.TransactionManager.Account.Address,
                    new HexBigInteger(8000000),
                    new HexBigInteger(0),
                    scwAddress,
                    amountInWei
                );

                var receipt = await web3.TransactionManager.TransactionReceiptService
                    .PollForReceiptAsync(txHash, new CancellationTokenSource(TimeSpan.FromSeconds(120)).Token);

                if (receipt == null || receipt.Status.Value != 1)
                {
                    _logger.LogError("Mint token thất bại. TxHash: {TxHash}", txHash);
                    throw new Exception($"Mint token thất bại. TxHash: {txHash}");
                }

                _logger.LogInformation("Mint token thành công cho {ScwAddress}. TxHash: {TxHash}", scwAddress, txHash);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi mint token: {Message}", ex.Message);
                throw;
            }

            // PHẦN 2: CHUYỂN ETH CHO NGƯỜI DÙNG
            try
            {
                // Luôn chuyển 50 ETH bất kể lý do
                var ethAmount = "50";
                var ethAmountInWei = UnitConversion.Convert.ToWei(decimal.Parse(ethAmount));

                // Kiểm tra số dư của admin
                var adminBalance = await web3.Eth.GetBalance.SendRequestAsync(web3.TransactionManager.Account.Address);
                if (adminBalance.Value < ethAmountInWei)
                {
                    _logger.LogError("Số dư ETH của admin không đủ. Cần: {Required}, Hiện có: {Available}",
                        ethAmount, UnitConversion.Convert.FromWei(adminBalance.Value));
                    throw new Exception("Số dư ETH của admin không đủ để thực hiện giao dịch.");
                }

                // Tạo giao dịch chuyển ETH
                var transactionInput = new TransactionInput
                {
                    From = web3.TransactionManager.Account.Address,
                    To = scwAddress,
                    Value = new HexBigInteger(ethAmountInWei),
                    Gas = new HexBigInteger(210000), // Gas cố định cho giao dịch chuyển ETH đơn giản
                    GasPrice = await web3.Eth.GasPrice.SendRequestAsync()
                };

                // Gửi giao dịch
                var ethTxHash = await web3.Eth.TransactionManager.SendTransactionAsync(transactionInput);

                // Chờ xác nhận giao dịch
                var ethReceipt = await web3.Eth.TransactionManager.TransactionReceiptService
                    .PollForReceiptAsync(ethTxHash, new CancellationTokenSource(TimeSpan.FromSeconds(120)).Token);

                if (ethReceipt == null || ethReceipt.Status.Value != 1)
                {
                    _logger.LogError("Chuyển ETH thất bại. TxHash: {TxHash}", ethTxHash);
                    throw new Exception($"Chuyển ETH thất bại. TxHash: {ethTxHash}");
                }

                _logger.LogInformation("Đã chuyển 50 ETH thành công cho {ScwAddress}. TxHash: {TxHash}",
                    scwAddress, ethTxHash);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi chuyển ETH: {Message}", ex.Message);
                // Không throw exception ở đây để đảm bảo mint token vẫn thành công ngay cả khi chuyển ETH thất bại
            }
        }

        public async Task<string> PredictSCWAddress(string factoryAddress, string eoaAddress, string salt)
        {
            if (!AddressUtil.Current.IsValidEthereumAddressHexFormat(factoryAddress) || !AddressUtil.Current.IsValidEthereumAddressHexFormat(eoaAddress))
            {
                _logger.LogError("Địa chỉ Factory hoặc EOA không hợp lệ.");
                throw new ArgumentException("Địa chỉ Factory hoặc EOA không hợp lệ.");
            }

            if (!salt.StartsWith("0x") || salt.Length != 66)
            {
                _logger.LogError("Salt không đúng định dạng bytes32: {Salt}", salt);
                throw new ArgumentException("Salt phải là chuỗi hex 32 byte.");
            }

            var web3 = new Web3(_rpcUrl);
            var factoryContract = web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, factoryAddress);
            var predictFunction = factoryContract.GetFunction("doanDiaChiSimpleAccount");

            var predictedAddress = await predictFunction.CallAsync<string>(salt.HexToByteArray(), eoaAddress);
            _logger.LogInformation("Dự đoán địa chỉ SCW: {PredictedAddress}", predictedAddress);
            return predictedAddress;
        }

        public async Task<BigInteger> GetCurrentGasPrice()
        {
            var web3 = new Web3(_rpcUrl);
            var gasPrice = await web3.Eth.GasPrice.SendRequestAsync();
            _logger.LogInformation("Giá gas hiện tại: {GasPrice} wei", gasPrice.Value);
            return gasPrice.Value;
        }

        public async Task<BigInteger> EstimateGasForBundledOps(string txData, string to)
        {
            var web3 = new Web3(_rpcUrl);
            try
            {
                var gasEstimate = await web3.Eth.Transactions.EstimateGas.SendRequestAsync(new CallInput(txData, to));
                var bufferedGas = gasEstimate.Value * 2;
                _logger.LogInformation("Ước tính gas cho bundled ops: {GasEstimate}, sau buffer: {BufferedGas}", gasEstimate.Value, bufferedGas);
                return bufferedGas;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Lỗi khi ước tính gas, dùng giá trị mặc định: 6000000");
                return 6000000;
            }
        }

        // Thêm vào BlockchainService.cs
        public Nethereum.Contracts.Function GetFactoryFunction(string functionName)
        {
            try
            {
                string factoryAddress = _configuration["BlockchainSettings:ContractAddresses:CuocBauCuFactory"];
                if (string.IsNullOrEmpty(factoryAddress))
                {
                    _logger.LogError("Không tìm thấy địa chỉ Factory trong cấu hình");
                    return null;
                }

                var web3 = new Web3(_rpcUrl);
                var factoryContract = web3.Eth.GetContract(ContractABIs.CuocBauCuFactory, factoryAddress);

                return factoryContract.GetFunction(functionName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi lấy function {FunctionName} từ Factory: {Error}",
                    functionName, ex.Message);
                return null;
            }
        }

        // Xóa ExecuteUserOperation và ExecuteUserOperationWithPaymaster vì front-end sẽ ký
    }
}