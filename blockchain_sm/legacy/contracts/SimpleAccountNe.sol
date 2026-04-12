// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IEntryPoint.sol";
import "./IHoLiHuToken.sol";
import "hardhat/console.sol";

contract SimpleAccountNe {
    using ECDSA for bytes32;

    IEntryPoint public immutable entryPoint;
    address public owner;
    IHoLiHuToken public hluToken;
    address public paymaster;
    bool private initialized;

    // Session keys: key => expiration timestamp (0 nếu không tồn tại)
    mapping(address => uint256) public sessionKeys;

    event AccountInitialized(address indexed entryPoint, address indexed owner);
    event SimpleAccountExecuted(address indexed target, uint256 value, bytes data);
    event SessionKeyAdded(address indexed key, uint256 expiration);
    event SessionKeyRevoked(address indexed key);

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "Only EntryPoint can call");
        _;
    }

    modifier initializer() {
        require(!initialized, "Already initialized");
        initialized = true;
        _;
    }

    constructor(address _entryPoint) {
        entryPoint = IEntryPoint(_entryPoint);
        initialized = false;
    }

    function initialize(address _owner, address _hluToken, address _paymaster) external initializer {
        require(_owner != address(0), "Invalid owner address");
        require(_hluToken != address(0), "Invalid HLU token");
        require(_paymaster != address(0), "Invalid paymaster");
        owner = _owner;
        hluToken = IHoLiHuToken(_hluToken);
        paymaster = _paymaster;
        emit AccountInitialized(address(entryPoint), _owner);
    }

    // Thêm session key (chỉ owner hoặc EntryPoint qua UserOp)
    function setSessionKey(address key, uint256 expiration) external {
        require(msg.sender == owner || msg.sender == address(entryPoint), "Only owner or EntryPoint");
        require(key != address(0), "Invalid session key");
        require(expiration > block.timestamp, "Expiration must be in future");
        sessionKeys[key] = expiration;
        emit SessionKeyAdded(key, expiration);
    }

    // Hủy session key
    function revokeSessionKey(address key) external {
        require(msg.sender == owner || msg.sender == address(entryPoint), "Only owner or EntryPoint");
        delete sessionKeys[key];
        emit SessionKeyRevoked(key);
    }

    function validateUserOp(
        IEntryPoint.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        address recovered = userOpHash.recover(userOp.signature);
        bool isOwner = recovered == owner;
        bool isValidSessionKey = sessionKeys[recovered] > block.timestamp;

        if (!isOwner && !isValidSessionKey) {
            console.log("Invalid signer: %s, owner: %s, session expiration: %s", recovered, owner, sessionKeys[recovered]);
            return 1; // Chữ ký không hợp lệ
        }

        if (missingAccountFunds > 0) {
            (bool success, ) = msg.sender.call{value: missingAccountFunds}("");
            if (!success) {
                console.log("Failed to send missing funds: %s", missingAccountFunds);
                return 1;
            }
        }
        console.log("UserOp validated successfully for signer: %s", recovered);
        return 0; // Hợp lệ
    }

    function execute(address dest, uint256 value, bytes calldata data) external onlyEntryPoint {
        console.log("SimpleAccount before call: %s, value: %s, data length: %s", dest, value, data.length);
        (bool success, bytes memory result) = dest.call{value: value}(data);
        console.log("SimpleAccount after call: %s, success: %s", dest, success);
        if (!success) {
            console.log("Execution failed with reason: %s", string(result));
            revert(string(abi.encodePacked("Execution failed: ", result)));
        }
        console.log("SimpleAccount executed successfully: %s", dest);
        emit SimpleAccountExecuted(dest, value, data);
    }

    function approveHLU(uint256 amount) external onlyEntryPoint {
        require(hluToken.balanceOf(address(this)) >= amount, "Insufficient HLU balance");
        require(hluToken.approve(paymaster, amount), "Approve HLU failed");
    }

    function getNonce() external view returns (uint256) {
        return entryPoint.getNonce(address(this));
    }

    receive() external payable {}
}