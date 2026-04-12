using System;
using System.Numerics;

namespace WebApplication3.Models
{
    /// <summary>
    /// Mô hình UserOperation theo chuẩn EIP-4337
    /// </summary>
    public class UserOperation
    {
        /// <summary>
        /// Địa chỉ của tài khoản người dùng gửi UserOp
        /// </summary>
        public string Sender { get; set; }

        /// <summary>
        /// Số dùng để ngăn chặn các giao dịch bị replay
        /// </summary>
        public BigInteger Nonce { get; set; }

        /// <summary>
        /// Mã khởi tạo tài khoản, rỗng nếu tài khoản đã tồn tại
        /// </summary>
        public string InitCode { get; set; }

        /// <summary>
        /// Calldata cho giao dịch
        /// </summary>
        public string CallData { get; set; }

        /// <summary>
        /// Giới hạn gas cho phần thực thi callData
        /// </summary>
        public BigInteger CallGasLimit { get; set; }

        /// <summary>
        /// Giới hạn gas cho phần xác thực
        /// </summary>
        public BigInteger VerificationGasLimit { get; set; }

        /// <summary>
        /// Gas trả trước cho bundler
        /// </summary>
        public BigInteger PreVerificationGas { get; set; }

        /// <summary>
        /// Giá gas tối đa sẵn lòng trả
        /// </summary>
        public BigInteger MaxFeePerGas { get; set; }

        /// <summary>
        /// Phí ưu tiên tối đa cho miner
        /// </summary>
        public BigInteger MaxPriorityFeePerGas { get; set; }

        /// <summary>
        /// Địa chỉ của paymaster và dữ liệu bổ sung
        /// </summary>
        public string PaymasterAndData { get; set; }

        /// <summary>
        /// Chữ ký của người dùng
        /// </summary>
        public string Signature { get; set; }
        public string UserOpHash { get; set; }

        /// <summary>
        /// Chuyển đổi từ DTO sang model
        /// </summary>
        public static UserOperation FromDTO(UserOperationDTO dto)
        {
            if (dto == null) return null;

            try
            {
                var userOp = new UserOperation
                {
                    Sender = dto.Sender,
                    Nonce = string.IsNullOrEmpty(dto.Nonce) ? BigInteger.Zero : BigInteger.Parse(dto.Nonce),
                    InitCode = dto.InitCode ?? "0x",
                    CallData = dto.CallData,
                    CallGasLimit = string.IsNullOrEmpty(dto.CallGasLimit) ? BigInteger.Zero : BigInteger.Parse(dto.CallGasLimit),
                    VerificationGasLimit = string.IsNullOrEmpty(dto.VerificationGasLimit) ? BigInteger.Zero : BigInteger.Parse(dto.VerificationGasLimit),
                    PreVerificationGas = string.IsNullOrEmpty(dto.PreVerificationGas) ? BigInteger.Zero : BigInteger.Parse(dto.PreVerificationGas),
                    MaxFeePerGas = string.IsNullOrEmpty(dto.MaxFeePerGas) ? BigInteger.Zero : BigInteger.Parse(dto.MaxFeePerGas),
                    MaxPriorityFeePerGas = string.IsNullOrEmpty(dto.MaxPriorityFeePerGas) ? BigInteger.Zero : BigInteger.Parse(dto.MaxPriorityFeePerGas),
                    PaymasterAndData = dto.PaymasterAndData ?? "0x",
                    Signature = dto.Signature ?? "0x",
                    UserOpHash = dto.UserOpHash // Thêm dòng này để gán UserOpHash
                };

                // Log tất cả các giá trị đã parse từ DTO để debug
                System.Diagnostics.Debug.WriteLine($"FromDTO: Sender={userOp.Sender}, Nonce={userOp.Nonce}");
                System.Diagnostics.Debug.WriteLine($"FromDTO: CallGasLimit={userOp.CallGasLimit}, VerificationGasLimit={userOp.VerificationGasLimit}, PreVerificationGas={userOp.PreVerificationGas}");
                System.Diagnostics.Debug.WriteLine($"FromDTO: UserOpHash={userOp.UserOpHash}");

                return userOp;
            }
            catch (Exception ex)
            {
                // Log lỗi để debug
                System.Diagnostics.Debug.WriteLine($"Error in FromDTO: {ex.Message}");
                throw new FormatException($"Error converting DTO to UserOperation: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Kiểm tra tính hợp lệ của UserOperation
        /// </summary>
        public bool IsValid()
        {
            try
            {
                // Log để debug
                System.Diagnostics.Debug.WriteLine($"IsValid: Sender={Sender}, Nonce={Nonce}");
                System.Diagnostics.Debug.WriteLine($"IsValid: CallGasLimit={CallGasLimit}, VerificationGasLimit={VerificationGasLimit}, PreVerificationGas={PreVerificationGas}");
                System.Diagnostics.Debug.WriteLine($"IsValid: PaymasterAndData={PaymasterAndData}, Length={PaymasterAndData?.Length ?? 0}");

                // Kiểm tra các trường bắt buộc
                if (string.IsNullOrEmpty(Sender) || !Sender.StartsWith("0x") || Sender.Length != 42)
                {
                    System.Diagnostics.Debug.WriteLine("IsValid: Invalid Sender");
                    return false;
                }

                if (string.IsNullOrEmpty(CallData) || !CallData.StartsWith("0x"))
                {
                    System.Diagnostics.Debug.WriteLine("IsValid: Invalid CallData");
                    return false;
                }

                // Kiểm tra giá trị gas
                if (CallGasLimit <= 0 || VerificationGasLimit <= 0 || PreVerificationGas <= 0)
                {
                    System.Diagnostics.Debug.WriteLine($"IsValid: Invalid gas values - CallGasLimit={CallGasLimit}, VerificationGasLimit={VerificationGasLimit}, PreVerificationGas={PreVerificationGas}");
                    return false;
                }

                if (MaxFeePerGas <= 0 || MaxPriorityFeePerGas <= 0)
                {
                    System.Diagnostics.Debug.WriteLine("IsValid: Invalid fee values");
                    return false;
                }

                // Cải tiến: Chấp nhận PaymasterAndData là một địa chỉ đơn thuần
                if (!string.IsNullOrEmpty(PaymasterAndData) && PaymasterAndData != "0x")
                {
                    if (PaymasterAndData.StartsWith("0x"))
                    {
                        // LƯỚI SỬA: Nếu là địa chỉ đơn thuần (42 ký tự với 0x), chấp nhận nó
                        // Sửa logic so sánh độ dài
                        if (PaymasterAndData.Length != 42)
                        {
                            System.Diagnostics.Debug.WriteLine($"IsValid: Invalid PaymasterAndData length: {PaymasterAndData.Length}");
                            return false;
                        }
                    }
                    else
                    {
                        System.Diagnostics.Debug.WriteLine("IsValid: PaymasterAndData not starting with 0x");
                        return false;
                    }
                }

                // Kiểm tra chữ ký
                if (string.IsNullOrEmpty(Signature) || !Signature.StartsWith("0x"))
                {
                    System.Diagnostics.Debug.WriteLine("IsValid: Invalid Signature");
                    return false;
                }

                System.Diagnostics.Debug.WriteLine("IsValid: UserOperation is valid");
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error in IsValid: {ex.Message}");
                return false;
            }
        }
    }
}