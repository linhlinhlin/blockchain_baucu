// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-v5/access/Ownable.sol";
import "@openzeppelin/contracts-v5/utils/cryptography/MerkleProof.sol";

/// @title ElectionV1
/// @notice Minimal commit-reveal election contract for EVM networks.
contract ElectionV1 is Ownable {
    enum Phase {
        Pending,
        Commit,
        Reveal,
        Ended,
        Finalized,
        Canceled
    }

    error InvalidSchedule();
    error InvalidAdmin();
    error InvalidMetadata();
    error InvalidEligibilityRoot();
    error InvalidCandidateSet();
    error InvalidCommitment();
    error InvalidPhase(Phase currentPhase);
    error NotEligible();
    error AlreadyCommitted();
    error NotCommitted();
    error AlreadyRevealed();
    error UnknownCandidate();
    error CommitmentMismatch();
    error AlreadyFinalized();
    error AlreadyCanceled();
    error CancellationWindowClosed();
    error QuorumNotReached(uint256 totalReveals, uint256 minReveals);

    event VoteCommitted(address indexed voter, bytes32 commitment);
    event VoteRevealed(address indexed voter, bytes32 indexed candidateId);
    event ElectionFinalized(uint256 totalCommits, uint256 totalReveals);
    event ElectionCanceled(bytes32 indexed reasonHash);
    // S9 (spec 002): turnout tường minh.
    event LowTurnout(uint256 totalReveals, uint256 minReveals);

    string public electionURI;
    bytes32 public immutable electionMetadataHash;
    bytes32 public immutable eligibleVotersRoot;
    uint64 public immutable commitStart;
    uint64 public immutable commitEnd;
    uint64 public immutable revealEnd;

    bytes32[] private _candidateIds;

    mapping(bytes32 candidateId => bool exists) public candidateExists;
    mapping(bytes32 candidateId => uint256 count) public voteCounts;
    mapping(address voter => bytes32 commitment) public commitments;
    mapping(address voter => bool revealed) public hasRevealed;

    // S9 (spec 002): ngưỡng turnout tối thiểu + cách xử lý khi không đạt.
    uint256 public immutable minReveals;
    bool public immutable enforceQuorum;

    uint256 public totalCommits;
    uint256 public totalReveals;
    bool public finalized;
    bool public canceled;
    bool public lowTurnout;
    bytes32 public cancellationReasonHash;

    constructor(
        address electionAdmin,
        string memory electionUri_,
        bytes32 electionMetadataHash_,
        bytes32 eligibleVotersRoot_,
        uint64 commitStart_,
        uint64 commitEnd_,
        uint64 revealEnd_,
        bytes32[] memory candidateIds_,
        uint256 minReveals_,
        bool enforceQuorum_
    ) Ownable(electionAdmin) {
        if (electionAdmin == address(0)) revert InvalidAdmin();
        if (bytes(electionUri_).length == 0 || electionMetadataHash_ == bytes32(0)) {
            revert InvalidMetadata();
        }
        if (eligibleVotersRoot_ == bytes32(0)) revert InvalidEligibilityRoot();
        if (
            commitStart_ >= commitEnd_ ||
            commitEnd_ >= revealEnd_ ||
            candidateIds_.length == 0
        ) {
            revert InvalidSchedule();
        }

        electionURI = electionUri_;
        electionMetadataHash = electionMetadataHash_;
        eligibleVotersRoot = eligibleVotersRoot_;
        commitStart = commitStart_;
        commitEnd = commitEnd_;
        revealEnd = revealEnd_;
        minReveals = minReveals_;
        enforceQuorum = enforceQuorum_;

        uint256 candidatesLength = candidateIds_.length;
        for (uint256 i = 0; i < candidatesLength; i++) {
            bytes32 candidateId = candidateIds_[i];
            if (candidateId == bytes32(0) || candidateExists[candidateId]) {
                revert InvalidCandidateSet();
            }

            candidateExists[candidateId] = true;
            _candidateIds.push(candidateId);
        }
    }

    function currentPhase() public view returns (Phase) {
        if (canceled) return Phase.Canceled;
        if (finalized) return Phase.Finalized;

        uint256 currentTime = block.timestamp;
        if (currentTime < commitStart) return Phase.Pending;
        if (currentTime < commitEnd) return Phase.Commit;
        if (currentTime < revealEnd) return Phase.Reveal;
        return Phase.Ended;
    }

    function candidateCount() external view returns (uint256) {
        return _candidateIds.length;
    }

    function getCandidateIds() external view returns (bytes32[] memory) {
        return _candidateIds;
    }

    function getResults()
        external
        view
        returns (bytes32[] memory candidateIds, uint256[] memory counts)
    {
        uint256 length = _candidateIds.length;
        candidateIds = new bytes32[](length);
        counts = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            bytes32 candidateId = _candidateIds[i];
            candidateIds[i] = candidateId;
            counts[i] = voteCounts[candidateId];
        }
    }

    function isEligible(address voter, bytes32[] calldata proof) public view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(voter))));
        return MerkleProof.verifyCalldata(proof, eligibleVotersRoot, leaf);
    }

    function computeCommitment(
        address voter,
        bytes32 candidateId,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), voter, candidateId, salt));
    }

    function commitVote(bytes32 commitment, bytes32[] calldata proof) external {
        Phase phase = currentPhase();
        if (phase != Phase.Commit) revert InvalidPhase(phase);
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (!isEligible(msg.sender, proof)) revert NotEligible();
        if (commitments[msg.sender] != bytes32(0)) revert AlreadyCommitted();

        commitments[msg.sender] = commitment;
        unchecked {
            totalCommits++;
        }

        emit VoteCommitted(msg.sender, commitment);
    }

    function revealVote(bytes32 candidateId, bytes32 salt) external {
        Phase phase = currentPhase();
        if (phase != Phase.Reveal) revert InvalidPhase(phase);
        if (!candidateExists[candidateId]) revert UnknownCandidate();
        if (commitments[msg.sender] == bytes32(0)) revert NotCommitted();
        if (hasRevealed[msg.sender]) revert AlreadyRevealed();

        bytes32 expectedCommitment = computeCommitment(msg.sender, candidateId, salt);
        if (expectedCommitment != commitments[msg.sender]) revert CommitmentMismatch();

        hasRevealed[msg.sender] = true;
        unchecked {
            voteCounts[candidateId]++;
            totalReveals++;
        }

        emit VoteRevealed(msg.sender, candidateId);
    }

    function finalizeElection() external {
        if (canceled) revert AlreadyCanceled();
        if (finalized) revert AlreadyFinalized();

        Phase phase = currentPhase();
        if (phase != Phase.Ended) revert InvalidPhase(phase);

        // S9: kiểm turnout. enforceQuorum=true ⇒ revert; false ⇒ chỉ gắn cờ.
        // minReveals=0 (mặc định) ⇒ điều kiện không bao giờ đúng ⇒ tương thích ngược.
        if (totalReveals < minReveals) {
            if (enforceQuorum) revert QuorumNotReached(totalReveals, minReveals);
            lowTurnout = true;
            emit LowTurnout(totalReveals, minReveals);
        }

        finalized = true;
        emit ElectionFinalized(totalCommits, totalReveals);
    }

    function cancelElection(bytes32 reasonHash) external onlyOwner {
        if (canceled) revert AlreadyCanceled();
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp >= commitStart) revert CancellationWindowClosed();

        canceled = true;
        cancellationReasonHash = reasonHash;

        emit ElectionCanceled(reasonHash);
    }
}
