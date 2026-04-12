// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IEntryPoint.sol";
import "./IHoLiHuToken.sol";

interface ISimpleAccountNe {
    // Events
    event AccountInitialized(address indexed entryPoint, address indexed owner);
    event SimpleAccountExecuted(address indexed target, uint256 value, bytes data);
    event SessionKeyAdded(address indexed key, uint256 expiration);
    event SessionKeyRevoked(address indexed key);
    event ValidationResult(address indexed signer, bool isOwner, bool isValidSessionKey, bool passed);
    event ApprovalForPaymaster(address indexed paymaster, uint256 amount);

    // Quản lý session keys
    function sessionKeys(address sessionKey) external view returns (uint256 expiration);
    function setSessionKey(address key, uint256 expiration) external;
    function revokeSessionKey(address key) external;
    
    // Thông tin chính của account
    function owner() external view returns (address);
    function entryPoint() external view returns (IEntryPoint);
    function paymaster() external view returns (address);
    function hluToken() external view returns (IHoLiHuToken);
    
    // Xử lý giao dịch và UserOps
    function execute(address dest, uint256 value, bytes calldata func) external;
    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
    
    // Quản lý token HLU
    function approveHLU(uint256 amount) external;
    function transferHLU(address to, uint256 amount) external;
    
    // Tiện ích
    function getNonce() external view returns (uint256);
    function initialize(address _owner, address _hluToken, address _paymaster) external;
}