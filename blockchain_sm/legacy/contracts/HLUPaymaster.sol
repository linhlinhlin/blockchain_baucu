// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IEntryPoint.sol";
import "./IHoLiHuToken.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";


// Interface tối thiểu để truy vấn session key từ SimpleAccountNe
interface ISimpleAccountNe {
    function sessionKeys(address sessionKey) external view returns (uint256 expiration);
    function owner() external view returns (address);
}

contract HLUPaymaster {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    IEntryPoint public immutable entryPoint;
    IHoLiHuToken public hluToken;
    address public owner;

    // Điều chỉnh các hằng số tính phí để hợp lý hơn
    uint256 public constant HLU_PER_GAS = 1e15; // 0.001 HLU per gas unit 
    uint256 public constant PRECISION = 1e18;   // 10^18 (1 token)

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    event UserOperationSponsored(address indexed user, uint256 actualGasCost, uint256 hluFee);
    event PostOpFailed(address indexed sender, uint256 actualGasCost, string reason);
    event SessionKeyValidated(address indexed account, address indexed sessionKey, bool valid);
    event OwnerValidated(address indexed account, address indexed ownerSigner, bool valid);

    constructor(address _entryPoint, address _hluToken) {
        require(_entryPoint != address(0), "Invalid EntryPoint");
        require(_hluToken != address(0), "Invalid HLU Token");
        entryPoint = IEntryPoint(_entryPoint);
        hluToken = IHoLiHuToken(_hluToken);
        owner = msg.sender;
    }

    /**
     * Kiểm tra xem một địa chỉ có phải là session key hợp lệ của một tài khoản không
     * @param account Địa chỉ của Smart Contract Wallet
     * @param potentialSessionKey Địa chỉ session key cần kiểm tra
     * @return true nếu là session key hợp lệ và chưa hết hạn
     */
    function isValidSessionKey(address account, address potentialSessionKey) public view returns (bool) {
        try ISimpleAccountNe(account).sessionKeys(potentialSessionKey) returns (uint256 expiration) {
            // Kiểm tra session key còn hiệu lực không
            return expiration > block.timestamp;
        } catch {
            // Nếu gọi lỗi, có thể không phải SimpleAccountNe hoặc không có session key
            return false;
        }
    }

    /**
     * Khôi phục địa chỉ người ký từ chữ ký và hash
     */
    function getSignerAddress(bytes32 userOpHash, bytes memory signature) public pure returns (address) {
        return userOpHash.recover(signature);
    }

   // Cải thiện validatePaymasterUserOp để rõ ràng hơn
function validatePaymasterUserOp(
    IEntryPoint.UserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 maxCost
) external returns (bytes memory context, uint256 validationData) {
    require(msg.sender == address(entryPoint), "Only EntryPoint can call");
    address sender = userOp.sender;
    
    // Xác định xem có phải tạo tài khoản mới không
    bool isAccountCreation = userOp.initCode.length > 0;
    
    // Tính phí HLU
    uint256 hluFee = isAccountCreation ? 0 : maxCost.mul(HLU_PER_GAS).div(PRECISION);
    
    // Kiểm tra số dư và allowance (bỏ qua với tài khoản mới)
    if (!isAccountCreation) {
        uint256 balance = hluToken.balanceOf(sender);
        uint256 allowance = hluToken.allowance(sender, address(this));
        
        console.log("HLU Balance:", balance);
        console.log("HLU Allowance:", allowance);
        console.log("Required HLU Fee:", hluFee);
        
        require(balance >= hluFee, "Insufficient HLU balance");
        require(allowance >= hluFee, "Insufficient HLU allowance");
    }
    
    // Đóng gói context để sử dụng trong postOp
    bytes memory encodedContext = abi.encode(
        sender,               // Địa chỉ người gửi
        userOp.maxFeePerGas,  // Phí gas tối đa
        isAccountCreation,    // Có phải tạo tài khoản mới không
        hluFee                // Phí HLU ước tính
    );
    
    console.log("Context encoded successfully");
    console.logBytes(encodedContext);

    return (encodedContext, 0);
}

// Cải thiện postOp để xử lý context rõ ràng hơn
function postOp(
    PostOpMode mode,
    bytes calldata context,
    uint256 actualGasCost
) external {
    require(msg.sender == address(entryPoint), "Only EntryPoint");

    console.log("postOp called with mode:", uint8(mode));
    console.log("actualGasCost:", actualGasCost);
    console.logBytes(context);

    try ISimpleAccountNe(address(0)).sessionKeys(address(0)) returns (uint256 expiration) {
        // Giải mã context
        (
            address sender,
            uint256 maxFeePerGas,
            bool isAccountCreation,
            uint256 estimatedHluFee
        ) = abi.decode(context, (address, uint256, bool, uint256));
        
        console.log("Decoded context - sender:", sender);
        console.log("maxFeePerGas:", maxFeePerGas);
        console.log("isAccountCreation:", isAccountCreation);
        console.log("estimatedHluFee:", estimatedHluFee);

        if (mode != PostOpMode.postOpReverted) {
            if (!isAccountCreation) {
                // Tính phí thực tế dựa trên gas đã sử dụng
                uint256 actualHluFee = actualGasCost.mul(HLU_PER_GAS).div(PRECISION);
                console.log("Actual HLU Fee:", actualHluFee);
                
                // Thu phí HLU từ người dùng
                require(hluToken.transferFrom(sender, address(this), actualHluFee), "HLU transfer failed");
                
                // Hoàn trả ETH cho EntryPoint nếu có ETH
                if (address(this).balance > 0) {
                    uint256 ethToRefund = actualGasCost.mul(maxFeePerGas);
                    console.log("ETH to refund:", ethToRefund);
                    (bool success, ) = address(entryPoint).call{value: ethToRefund}("");
                    require(success, "Failed to refund EntryPoint");
                }

                emit UserOperationSponsored(sender, actualGasCost, actualHluFee);
            } else {
                // Xử lý trường hợp tạo tài khoản mới
                emit UserOperationSponsored(sender, actualGasCost, 0);
            }
        } else {
            emit PostOpFailed(sender, actualGasCost, "PostOp reverted");
        }
    } catch (bytes memory reason) {
        console.log("Error in postOp:");
        console.logBytes(reason);
        emit PostOpFailed(address(0), actualGasCost, "Context decode failed");
    }
}

    /**
     * Chủ sở hữu có thể rút HLU token từ contract
     */
    function withdrawHLU(address to, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        require(hluToken.transfer(to, amount), "HLU transfer failed");
    }

    // Cho phép contract nhận ETH
    receive() external payable {}
}