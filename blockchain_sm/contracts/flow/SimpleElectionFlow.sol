// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-v5/access/Ownable.sol";

/// @title SimpleElectionFlow
/// @notice Direct-vote election contract for end-to-end UX testing.
contract SimpleElectionFlow is Ownable {
    struct CandidateConfig {
        bytes32 candidateId;
        string displayName;
        address walletAddress;
    }

    enum Status {
        Pending,
        Active,
        Ended
    }

    error InvalidAdmin();
    error InvalidSchedule();
    error InvalidCandidateSet();
    error InvalidMetadata();
    error InvalidStatus(Status currentStatus);
    error AlreadyVoted();
    error UnknownCandidate();
    error DuplicateCandidateId();

    event VoteCast(
        address indexed voter,
        uint256 indexed candidateIndex,
        bytes32 indexed candidateId,
        string candidateName,
        address candidateWalletAddress,
        uint256 timestamp
    );

    string public title;
    string public description;
    uint64 public immutable startAt;
    uint64 public immutable endAt;

    CandidateConfig[] private _candidates;
    uint256[] private _voteCounts;

    mapping(address voter => bool voted) public hasVoted;
    mapping(address voter => uint256 candidateIndexPlusOne) public votedCandidateIndexPlusOne;

    uint256 public totalVotes;

    constructor(
        address owner_,
        string memory title_,
        string memory description_,
        uint64 startAt_,
        uint64 endAt_,
        CandidateConfig[] memory candidates_
    ) Ownable(owner_) {
        if (owner_ == address(0)) revert InvalidAdmin();
        if (bytes(title_).length == 0) revert InvalidMetadata();
        if (startAt_ >= endAt_) revert InvalidSchedule();
        if (candidates_.length < 2) revert InvalidCandidateSet();

        title = title_;
        description = description_;
        startAt = startAt_;
        endAt = endAt_;

        for (uint256 i = 0; i < candidates_.length; i++) {
            CandidateConfig memory candidate = candidates_[i];
            if (candidate.candidateId == bytes32(0) || bytes(candidate.displayName).length == 0) {
                revert InvalidCandidateSet();
            }

            for (uint256 j = 0; j < i; j++) {
                if (_candidates[j].candidateId == candidate.candidateId) {
                    revert DuplicateCandidateId();
                }
            }

            _candidates.push(candidate);
            _voteCounts.push(0);
        }
    }

    function status() public view returns (Status) {
        uint256 currentTime = block.timestamp;
        if (currentTime < startAt) {
            return Status.Pending;
        }
        if (currentTime < endAt) {
            return Status.Active;
        }
        return Status.Ended;
    }

    function candidateCount() external view returns (uint256) {
        return _candidates.length;
    }

    function getCandidateNames() external view returns (string[] memory) {
        uint256 length = _candidates.length;
        string[] memory candidateNames = new string[](length);
        for (uint256 i = 0; i < length; i++) {
            candidateNames[i] = _candidates[i].displayName;
        }

        return candidateNames;
    }

    function getCandidates()
        external
        view
        returns (bytes32[] memory candidateIds, string[] memory candidateNames, address[] memory candidateWallets)
    {
        uint256 length = _candidates.length;
        candidateIds = new bytes32[](length);
        candidateNames = new string[](length);
        candidateWallets = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            CandidateConfig storage candidate = _candidates[i];
            candidateIds[i] = candidate.candidateId;
            candidateNames[i] = candidate.displayName;
            candidateWallets[i] = candidate.walletAddress;
        }
    }

    function getResults()
        external
        view
        returns (
            bytes32[] memory candidateIds,
            string[] memory candidateNames,
            address[] memory candidateWallets,
            uint256[] memory counts
        )
    {
        (candidateIds, candidateNames, candidateWallets) = this.getCandidates();
        counts = new uint256[](_voteCounts.length);
        for (uint256 i = 0; i < _voteCounts.length; i++) {
            counts[i] = _voteCounts[i];
        }
    }

    function castVote(uint256 candidateIndex) external {
        Status currentStatus = status();
        if (currentStatus != Status.Active) revert InvalidStatus(currentStatus);
        if (hasVoted[msg.sender]) revert AlreadyVoted();
        if (candidateIndex >= _candidates.length) revert UnknownCandidate();

        hasVoted[msg.sender] = true;
        votedCandidateIndexPlusOne[msg.sender] = candidateIndex + 1;
        _voteCounts[candidateIndex]++;
        totalVotes++;

        CandidateConfig storage candidate = _candidates[candidateIndex];

        emit VoteCast(
            msg.sender,
            candidateIndex,
            candidate.candidateId,
            candidate.displayName,
            candidate.walletAddress,
            block.timestamp
        );
    }
}
