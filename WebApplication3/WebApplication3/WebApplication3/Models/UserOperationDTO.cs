using System.Numerics;

namespace WebApplication3.Models
{
    /// <summary>
    /// DTO cho UserOperation theo chuẩn EIP-4337
    /// </summary>
    public class UserOperationDTO
    {
        /// <summary>
        /// Địa chỉ của tài khoản người dùng gửi UserOp
        /// </summary>
        public string Sender { get; set; }

        /// <summary>
        /// Số dùng để ngăn chặn các giao dịch bị replay và phân biệt giữa các giao dịch
        /// </summary>
        public string Nonce { get; set; }

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
        public string CallGasLimit { get; set; }

        /// <summary>
        /// Giới hạn gas cho phần xác thực
        /// </summary>
        public string VerificationGasLimit { get; set; }

        /// <summary>
        /// Gas trả trước cho bundler
        /// </summary>
        public string PreVerificationGas { get; set; }

        /// <summary>
        /// Giá gas tối đa sẵn lòng trả
        /// </summary>
        public string MaxFeePerGas { get; set; }

        /// <summary>
        /// Phí ưu tiên tối đa cho miner
        /// </summary>
        public string MaxPriorityFeePerGas { get; set; }

        /// <summary>
        /// Địa chỉ của paymaster và dữ liệu bổ sung
        /// </summary>
        public string PaymasterAndData { get; set; }

        /// <summary>
        /// Chữ ký của người dùng
        /// </summary>
        public string Signature { get; set; }

        /// <summary>
        /// [CẢI TIẾN] UserOpHash được tính từ frontend
        /// Thêm trường này để phía backend có thể sử dụng hash đã tính từ frontend
        /// thay vì tính lại, đảm bảo tính nhất quán
        /// </summary>
        public string UserOpHash { get; set; }
    }
}