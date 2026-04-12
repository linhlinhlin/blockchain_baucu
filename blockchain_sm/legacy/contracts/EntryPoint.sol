// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

contract EntryPoint {
    using ECDSA for bytes32;

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

    mapping(address => uint256) public nonceNguoiGui;
    mapping(address => bool) public paymasterTrangDanhSach;

    event ThaoTacNguoiDungDuocThucThi(address indexed sender, uint256 nonce, bool thanhCong);
    event PaymasterThemVaoTrangDanhSach(address indexed paymaster);
    event ThucThiThaoTac(address indexed sender, bool thanhCong, uint256 gasSuDung);
    event PostOpThatBai(address indexed paymaster, uint256 nonce, string lyDo);
    event PaymasterXacThucThanhCong(address indexed paymaster, address indexed sender);
    event TaoNguoiGuiThanhCong(address indexed nguoiGui, uint256 gasUsed);

    address public immutable quanTri;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant USER_OPERATION_TYPEHASH = keccak256(
        "UserOperation(address sender,uint256 nonce,bytes initCode,bytes callData,uint256 callGasLimit,uint256 verificationGasLimit,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,bytes paymasterAndData)"
    );
    bytes32 private immutable DOMAIN_SEPARATOR;

    constructor() {
        quanTri = msg.sender;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("EntryPoint")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function themPaymaster(address paymaster) external {
        require(msg.sender == quanTri, "Chi quan tri duoc goi");
        paymasterTrangDanhSach[paymaster] = true;
        emit PaymasterThemVaoTrangDanhSach(paymaster);
    }

    // Cấu trúc lỗi theo ERC-4337
    error FailedOp(uint256 opIndex, string reason);
    error SignatureValidationFailed(uint256 opIndex, string reason);

    // Mapping cho nonce linh hoạt: sender => key => sequence
    mapping(address => mapping(uint192 => uint64)) private nonceSequences;

    function getNonce(address sender) external view returns (uint256) {
        return nonceNguoiGui[sender];
    }

    // Hàm lấy nonce linh hoạt theo ERC-4337
    function getNonceSequenceNumber(address sender, uint192 key) external view returns (uint256) {
        return (uint256(key) << 64) | nonceSequences[sender][key];
    }

    function xuLyCacThaoTac(UserOperation[] calldata cacThaoTac, address payable nguoiThuHuong) external {
        require(cacThaoTac.length <= 100, "AA10 too many ops");
        
        for (uint256 i = 0; i < cacThaoTac.length; ) {
            UserOperation memory thaoTac = cacThaoTac[i];
            
            // Kiểm tra nonce linh hoạt theo ERC-4337
            uint256 nonce = thaoTac.nonce;
            uint192 key = uint192(nonce >> 64);
            uint64 seq = uint64(nonce);
            
            // Nếu key = 0, dùng nonce tuần tự truyền thống
            if (key == 0) {
                uint256 nonceCu = nonceNguoiGui[thaoTac.sender];
                if (nonceCu != seq) 
                    revert FailedOp(i, "AA25 invalid nonce");
                
                // Tăng nonce tuần tự
                nonceNguoiGui[thaoTac.sender] = nonceCu + 1;
            } else {
                // Kiểm tra nonce theo sequence
                uint64 seqCu = nonceSequences[thaoTac.sender][key];
                if (seqCu != seq) 
                    revert FailedOp(i, "AA25 invalid nonce");
                
                // Tăng sequence
                nonceSequences[thaoTac.sender][key] = seqCu + 1;
            }

            if (thaoTac.initCode.length == 0) {
                uint256 codeSize;
                address sender = thaoTac.sender;
                assembly { codeSize := extcodesize(sender) }
                if (codeSize == 0)
                    revert FailedOp(i, "AA20 account not deployed");
            } else {
                if (gasleft() <= thaoTac.verificationGasLimit + 50000)
                    revert FailedOp(i, "AA23 reverted (or OOG)");
                    
                try this._taoNguoiGui(thaoTac.sender, thaoTac.initCode) {
                    // Tạo thành công
                } catch Error(string memory reason) {
                    revert FailedOp(i, string.concat("AA21 failed deploying sender: ", reason));
                } catch {
                    revert FailedOp(i, "AA21 failed deploying sender");
                }
            }

            bytes32 hashThaoTac = layHashThaoTac(thaoTac);
            
            if (gasleft() <= thaoTac.verificationGasLimit + 10000)
                revert FailedOp(i, "AA23 reverted (or OOG)");
                
            uint256 duLieuXacThuc;
            try this._xacThucThaoTac(thaoTac, hashThaoTac) returns (uint256 result) {
                duLieuXacThuc = result;
            } catch Error(string memory reason) {
                revert FailedOp(i, string.concat("AA24 signature error: ", reason));
            } catch {
                revert FailedOp(i, "AA24 signature error");
            }
            
            if (duLieuXacThuc != 0) {
                // Kiểm tra validUntil và validAfter
                uint256 validUntil = duLieuXacThuc >> 160;
                uint256 validAfter = (duLieuXacThuc >> 160 + 48) & 0xFFFFFFFFFFFF;
                bool sigFailed = duLieuXacThuc & 1 == 1;
                
                if (sigFailed)
                    revert SignatureValidationFailed(i, "AA24 signature error");
                    
                if (validUntil != 0 && validUntil < block.timestamp)
                    revert FailedOp(i, "AA22 expired");
                    
                if (validAfter != 0 && validAfter > block.timestamp)
                    revert FailedOp(i, "AA22 not yet valid");
            }

            if (gasleft() <= thaoTac.callGasLimit + thaoTac.verificationGasLimit / 2)
                revert FailedOp(i, "AA23 reverted (or OOG)");
                
            try this._thucThiThaoTac(thaoTac, hashThaoTac, nguoiThuHuong) {
                // Thực thi thành công
            } catch Error(string memory reason) {
                revert FailedOp(i, string.concat("AA50 execution reverted: ", reason));
            } catch {
                revert FailedOp(i, "AA50 execution reverted");
            }

            unchecked { i++; }
        }
    }
    
    // Helper function để gọi trong try/catch
    function _taoNguoiGui(address nguoiGui, bytes memory maKhoiTao) external returns (bool) {
        require(msg.sender == address(this), "Only self");
        require(maKhoiTao.length > 0, "Ma khoi tao rong");
        require(gasleft() > 100_000, "Gas khong du de tao SCW");
        
        // Kiểm tra độ dài initCode
        require(maKhoiTao.length >= 32, "InitCode qua ngan");
        
        // Tách mã khởi tạo và salt
        bytes memory maTao = new bytes(maKhoiTao.length - 32);
        bytes32 saltValue;
        
        assembly {
            let srcPtr := add(add(maKhoiTao, 32), 0)
            let destPtr := add(maTao, 32)
            let len := sub(mload(maKhoiTao), 32)
            mstore(maTao, len)
            
            for { let i := 0 } lt(i, len) { i := add(i, 32) } {
                mstore(add(destPtr, i), mload(add(srcPtr, i)))
            }
            
            saltValue := mload(add(add(maKhoiTao, 32), len))
        }
        
        // Tính địa chỉ dự đoán và so sánh
        address diaChiDuDoan = Create2.computeAddress(saltValue, keccak256(maTao), address(this));
        require(diaChiDuDoan == nguoiGui, "Dia chi khong khop");

        // Triển khai contract nếu chưa tồn tại
        uint256 codeSize;
        assembly { codeSize := extcodesize(diaChiDuDoan) }
        if (codeSize == 0) {
            uint256 gasTruoc = gasleft();
            Create2.deploy(0, saltValue, maTao);
            uint256 gasSuDung = gasTruoc - gasleft();
            
            assembly { codeSize := extcodesize(diaChiDuDoan) }
            require(codeSize > 0, "Trien khai SCW that bai");
            
            // Kiểm tra bytecode hợp lệ (để tránh front-running)
            bytes32 codeHash;
            assembly { codeHash := extcodehash(diaChiDuDoan) }
            require(codeHash != bytes32(0), "Invalid bytecode");
            
            emit TaoNguoiGuiThanhCong(nguoiGui, gasSuDung);
        }
        
        return true;
    }
    
    // Helper function để gọi trong try/catch
    function _xacThucThaoTac(UserOperation memory thaoTac, bytes32 hashThaoTac) external returns (uint256) {
        require(msg.sender == address(this), "Only self");
        require(gasleft() >= thaoTac.verificationGasLimit + 10000, "Gas khong du de xac thuc");
        
        // Gọi hàm validateUserOp của smart contract wallet
        (bool thanhCong, bytes memory ketQua) = thaoTac.sender.call{gas: thaoTac.verificationGasLimit}(
            abi.encodeWithSignature(
                "validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256)",
                thaoTac,
                hashThaoTac,
                thaoTac.maxFeePerGas * thaoTac.callGasLimit
            )
        );
        
        require(thanhCong, "AA23 reverted (or OOG)");
        return abi.decode(ketQua, (uint256));
    }
    
    // Helper function để gọi trong try/catch
    function _thucThiThaoTac(UserOperation memory thaoTac, bytes32 hashThaoTac, address payable) external {
        require(msg.sender == address(this), "Only self");
        require(gasleft() > thaoTac.callGasLimit + thaoTac.verificationGasLimit / 2, "Gas khong du de thuc thi");
        
        address nguoiThanhToan = address(0);
        bytes memory nguCanh;
        bool coPaymaster = false;

        // Xử lý Paymaster nếu có
        if (thaoTac.paymasterAndData.length >= 20) {
            // Đảm bảo độ dài đủ để chứa ít nhất một địa chỉ Ethereum
            nguoiThanhToan = _extractPaymaster(thaoTac.paymasterAndData);
            
            require(paymasterTrangDanhSach[nguoiThanhToan], "AA30 paymaster not in whitelist");
            
            // Gọi hàm validatePaymasterUserOp của paymaster
            (bool thanhCongRoi, bytes memory ketQuaRaw) = nguoiThanhToan.call{gas: thaoTac.verificationGasLimit}(
                abi.encodeWithSignature(
                    "validatePaymasterUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256)",
                    thaoTac,
                    hashThaoTac,
                    thaoTac.maxFeePerGas * thaoTac.callGasLimit
                )
            );
            
            require(thanhCongRoi, "AA31 paymaster validation failed");
            (nguCanh, ) = abi.decode(ketQuaRaw, (bytes, uint256)); // Tách context từ tuple
            coPaymaster = true;
            
            emit PaymasterXacThucThanhCong(nguoiThanhToan, thaoTac.sender);
        }

        // Thực thi giao dịch chính
        uint256 gasTruoc = gasleft();
        (bool thanhCong,) = thaoTac.sender.call{gas: thaoTac.callGasLimit}(thaoTac.callData);
        uint256 gasSuDung = gasTruoc - gasleft();
        
        emit ThaoTacNguoiDungDuocThucThi(thaoTac.sender, thaoTac.nonce, thanhCong);
        emit ThucThiThaoTac(thaoTac.sender, thanhCong, gasSuDung);

        // Gọi postOp nếu có paymaster
        if (coPaymaster) {
            uint8 postOpMode = thanhCong ? 0 : 1; // 0=opSucceeded, 1=opReverted
            
            
                // Đảm bảo đủ gas cho postOp
                uint256 gasForPostOp = thaoTac.verificationGasLimit / 2;
                require(gasleft() >= gasForPostOp, "AA51 not enough gas for postOp");
                
                (bool postOpThanhCong,) = nguoiThanhToan.call{gas: gasForPostOp}(
                    abi.encodeWithSignature(
                        "postOp(uint8,bytes,uint256)",
                        postOpMode, // opSucceeded hoặc opReverted
                        nguCanh,
                        gasSuDung
                    )
                );
                
                if (!postOpThanhCong) {
                    // Log mà không revert để không ảnh hưởng đến userOp
                    emit PostOpThatBai(nguoiThanhToan, thaoTac.nonce, "AA40 postOp reverted");
                }
                // Không revert nếu postOp gặp lỗi
        }
        
        require(thanhCong, "AA41 innerOp failed");
    }

    // Mô phỏng validation của UserOperation
    /*function simulateValidation(UserOperation calldata thaoTac) external returns (uint256) {
        // Chỉ cho phép gọi từ chính EntryPoint để tránh lạm dụng
        require(msg.sender == address(0), "Only off-chain simulation");

        // Kiểm tra nonce
        uint256 nonce = thaoTac.nonce;
        uint192 key = uint192(nonce >> 64);
        uint64 seq = uint64(nonce);

        if (key == 0) {
            uint256 nonceCu = nonceNguoiGui[thaoTac.sender];
            if (nonceCu != seq) revert FailedOp(0, "AA25 invalid nonce");
        } else {
            uint64 seqCu = nonceSequences[thaoTac.sender][key];
            if (seqCu != seq) revert FailedOp(0, "AA25 invalid nonce");
        }

        // Kiểm tra initCode
        if (thaoTac.initCode.length > 0) {
            revert("AA95 simulation does not support initCode");
        } else {
            uint256 codeSize;
            assembly { codeSize := extcodesize(thaoTac.sender) }
            if (codeSize == 0) revert FailedOp(0, "AA20 account not deployed");
        }

        // Tạo hash và gọi validateUserOp
        bytes32 hashThaoTac = layHashThaoTac(thaoTac);
        (bool success, bytes memory result) = thaoTac.sender.call{gas: thaoTac.verificationGasLimit}(
            abi.encodeWithSignature(
                "validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256)",
                thaoTac,
                hashThaoTac,
                thaoTac.maxFeePerGas * thaoTac.callGasLimit
            )
        );

        if (!success) revert FailedOp(0, "AA23 reverted (or OOG)");
        uint256 validationData = abi.decode(result, (uint256));

        // Kiểm tra Paymaster nếu có
        if (thaoTac.paymasterAndData.length >= 20) {
            address paymaster = _extractPaymaster(thaoTac.paymasterAndData);
            if (!paymasterTrangDanhSach[paymaster]) revert FailedOp(0, "AA30 paymaster not in whitelist");

            (success, result) = paymaster.call{gas: thaoTac.verificationGasLimit}(
                abi.encodeWithSignature(
                    "validatePaymasterUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes),bytes32,uint256)",
                    thaoTac,
                    hashThaoTac,
                    thaoTac.maxFeePerGas * thaoTac.callGasLimit
                )
            );
            if (!success) revert FailedOp(0, "AA31 paymaster validation failed");
        }

        return validationData;
    }
    */

    function _extractPaymaster(bytes memory paymasterAndData) internal pure returns (address paymaster) {
        require(paymasterAndData.length >= 20, "PaymasterAndData qua ngan");
        
        // Lấy ra địa chỉ paymaster từ 20 byte đầu tiên
        assembly {
            paymaster := mload(add(paymasterAndData, 20))
            // Điều chỉnh để đưa về đúng định dạng địa chỉ Ethereum (20 byte)
            paymaster := and(paymaster, 0xffffffffffffffffffffffffffffffffffffffff)
        }
        
        return paymaster;
    }

    function layHashThaoTac(UserOperation memory thaoTac) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                USER_OPERATION_TYPEHASH,
                thaoTac.sender,
                thaoTac.nonce,
                keccak256(thaoTac.initCode),
                keccak256(thaoTac.callData),
                thaoTac.callGasLimit,
                thaoTac.verificationGasLimit,
                thaoTac.preVerificationGas,
                thaoTac.maxFeePerGas,
                thaoTac.maxPriorityFeePerGas,
                keccak256(thaoTac.paymasterAndData)
            )
        );
    }

    receive() external payable {}
    fallback() external payable {}
}