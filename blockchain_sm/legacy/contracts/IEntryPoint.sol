// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

interface IEntryPoint {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    // Cấu trúc lỗi theo ERC-4337
    error FailedOp(uint256 opIndex, string reason);
    error SignatureValidationFailed(uint256 opIndex, string reason);

    // Các events
    event ThaoTacNguoiDungDuocThucThi(address indexed sender, uint256 nonce, bool thanhCong);
    event PaymasterThemVaoTrangDanhSach(address indexed paymaster);
    event ThucThiThaoTac(address indexed sender, bool thanhCong, uint256 gasSuDung);
    event PostOpThatBai(address indexed paymaster, uint256 nonce, string lyDo);
    event PaymasterXacThucThanhCong(address indexed paymaster, address indexed sender);
    event TaoNguoiGuiThanhCong(address indexed nguoiGui, uint256 gasUsed);

    // Quản lý Paymaster
    function themPaymaster(address paymaster) external;
    function paymasterTrangDanhSach(address) external view returns (bool);
    
    // Xử lý UserOperation
    function xuLyCacThaoTac(UserOperation[] calldata cacThaoTac, address payable nguoiThuHuong) external;
    function layHashThaoTac(UserOperation memory thaoTac) external pure returns (bytes32);
    
    // Quản lý nonce
    function getNonce(address sender) external view returns (uint256);
    function getNonceSequenceNumber(address sender, uint192 key) external view returns (uint256);
    function nonceNguoiGui(address) external view returns (uint256);
    
    // Internal function helpers (được gọi từ các phương thức khác)
    function _taoNguoiGui(address nguoiGui, bytes memory maKhoiTao) external returns (bool);
    function _xacThucThaoTac(UserOperation memory thaoTac, bytes32 hashThaoTac) external returns (uint256);
    function _thucThiThaoTac(UserOperation memory thaoTac, bytes32 hashThaoTac, address payable nguoiThuHuong) external;
    
    // Thông tin quản trị
    function quanTri() external view returns (address);
}