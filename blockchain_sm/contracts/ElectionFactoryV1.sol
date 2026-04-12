// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-v5/access/Ownable.sol";
import "./ElectionV1.sol";

/// @title ElectionFactoryV1
/// @notice Registry and deployment entrypoint for immutable election instances.
contract ElectionFactoryV1 is Ownable {
    error CreatorNotAuthorized();
    error InvalidAdmin();
    error InvalidPagination();

    event CreatorAuthorizationUpdated(address indexed creator, bool authorized);
    event ElectionCreated(
        uint256 indexed electionId,
        address indexed electionAddress,
        address indexed admin,
        bytes32 metadataHash,
        bytes32 eligibleVotersRoot,
        uint64 commitStart,
        uint64 commitEnd,
        uint64 revealEnd
    );

    struct ElectionConfig {
        address admin;
        string electionURI;
        bytes32 electionMetadataHash;
        bytes32 eligibleVotersRoot;
        uint64 commitStart;
        uint64 commitEnd;
        uint64 revealEnd;
        bytes32[] candidateIds;
    }

    uint256 public electionCount;
    mapping(address creator => bool authorized) public authorizedCreators;
    mapping(uint256 electionId => address electionAddress) public elections;

    constructor() Ownable(msg.sender) {
        authorizedCreators[msg.sender] = true;
        emit CreatorAuthorizationUpdated(msg.sender, true);
    }

    modifier onlyCreator() {
        if (!authorizedCreators[msg.sender]) revert CreatorNotAuthorized();
        _;
    }

    function setCreatorAuthorization(address creator, bool authorized) external onlyOwner {
        authorizedCreators[creator] = authorized;
        emit CreatorAuthorizationUpdated(creator, authorized);
    }

    function createElection(ElectionConfig calldata config)
        external
        onlyCreator
        returns (uint256 electionId, address electionAddress)
    {
        if (config.admin == address(0)) revert InvalidAdmin();

        ElectionV1 election = new ElectionV1(
            config.admin,
            config.electionURI,
            config.electionMetadataHash,
            config.eligibleVotersRoot,
            config.commitStart,
            config.commitEnd,
            config.revealEnd,
            config.candidateIds
        );

        unchecked {
            electionCount++;
        }
        electionId = electionCount;
        electionAddress = address(election);
        elections[electionId] = electionAddress;

        emit ElectionCreated(
            electionId,
            electionAddress,
            config.admin,
            config.electionMetadataHash,
            config.eligibleVotersRoot,
            config.commitStart,
            config.commitEnd,
            config.revealEnd
        );
    }

    function getElectionAddresses(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory electionAddresses)
    {
        if (limit == 0) revert InvalidPagination();
        if (offset >= electionCount) {
            return new address[](0);
        }

        uint256 endExclusive = offset + limit;
        if (endExclusive > electionCount) {
            endExclusive = electionCount;
        }

        uint256 length = endExclusive - offset;
        electionAddresses = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            electionAddresses[i] = elections[offset + i + 1];
        }
    }
}
