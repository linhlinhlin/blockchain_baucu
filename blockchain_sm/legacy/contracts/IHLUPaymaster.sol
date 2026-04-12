// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IEntryPoint.sol";
import "./IHoLiHuToken.sol";

interface IHLUPaymaster {
    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    // Events
    event UserOperationSponsored(address indexed user, uint256 actualGasCost, uint256 hluFee);
    event PostOpFailed(address indexed sender, uint256 actualGasCost, string reason);
    event SessionKeyValidated(address indexed account, address indexed sessionKey, bool valid);
    event OwnerValidated(address indexed account, address indexed ownerSigner, bool valid);

    // Xác thực và xử lý UserOperation
    function validatePaymasterUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;

    // Kiểm tra session key
    function isValidSessionKey(address account, address potentialSessionKey) external view returns (bool);

    // Quản lý token HLU
    function withdrawHLU(address to, uint256 amount) external;
    
    // Quản lý ETH
    function depositEth() external payable;
    function withdrawEth(address payable to, uint256 amount) external;

    // Thông tin cấu hình
    function entryPoint() external view returns (IEntryPoint);
    function hluToken() external view returns (IHoLiHuToken);
    function owner() external view returns (address);
    function HLU_PER_GAS() external pure returns (uint256);
    function PRECISION() external pure returns (uint256);
}