// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/ElectionFactoryV1.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function assume(bool) external;
    function expectRevert(bytes4) external;
}

contract ElectionV1FoundryTest {
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ElectionFactoryV1 internal factory;
    ElectionV1 internal election;

    address internal creator = address(0x1001);
    address internal admin = address(0x1002);
    address internal voter1 = address(0x1003);
    address internal voter2 = address(0x1004);
    address internal outsider = address(0x1005);

    bytes32 internal constant CANDIDATE_A = keccak256("candidate-a");
    bytes32 internal constant CANDIDATE_B = keccak256("candidate-b");

    uint64 internal commitStart;
    uint64 internal commitEnd;
    uint64 internal revealEnd;

    function setUp() public {
        factory = new ElectionFactoryV1();
        factory.setCreatorAuthorization(creator, true);

        commitStart = uint64(block.timestamp + 10);
        commitEnd = uint64(block.timestamp + 110);
        revealEnd = uint64(block.timestamp + 210);

        bytes32[] memory candidateIds = new bytes32[](2);
        candidateIds[0] = CANDIDATE_A;
        candidateIds[1] = CANDIDATE_B;

        ElectionFactoryV1.ElectionConfig memory config = ElectionFactoryV1.ElectionConfig({
            admin: admin,
            electionURI: "ipfs://holihu/elections/class-president-2026",
            electionMetadataHash: keccak256("class-president-2026-manifest"),
            eligibleVotersRoot: _root(),
            commitStart: commitStart,
            commitEnd: commitEnd,
            revealEnd: revealEnd,
            candidateIds: candidateIds,
            minReveals: 0,
            enforceQuorum: false
        });

        vm.prank(creator);
        (, address electionAddress) = factory.createElection(config);
        election = ElectionV1(electionAddress);
    }

    function testCommitRevealFinalizeFlow() public {
        vm.warp(commitStart);

        bytes32 salt = keccak256("voter1-salt");
        bytes32 commitment = election.computeCommitment(voter1, CANDIDATE_A, salt);

        vm.prank(voter1);
        election.commitVote(commitment, _proofFor(voter1));

        vm.warp(commitEnd);

        vm.prank(voter1);
        election.revealVote(CANDIDATE_A, salt);

        vm.warp(revealEnd + 1);
        election.finalizeElection();

        require(election.finalized(), "expected election to be finalized");
        require(election.voteCounts(CANDIDATE_A) == 1, "expected one vote for candidate A");
        require(election.totalReveals() == 1, "expected one revealed vote");
    }

    function testCannotCommitTwice() public {
        vm.warp(commitStart);

        bytes32 salt = keccak256("repeat-salt");
        bytes32 commitment = election.computeCommitment(voter1, CANDIDATE_A, salt);

        vm.prank(voter1);
        election.commitVote(commitment, _proofFor(voter1));

        vm.expectRevert(ElectionV1.AlreadyCommitted.selector);
        vm.prank(voter1);
        election.commitVote(commitment, _proofFor(voter1));
    }

    function testCannotCommitWithoutEligibility() public {
        vm.warp(commitStart);

        bytes32 salt = keccak256("outsider-salt");
        bytes32 commitment = election.computeCommitment(outsider, CANDIDATE_A, salt);

        vm.expectRevert(ElectionV1.NotEligible.selector);
        vm.prank(outsider);
        election.commitVote(commitment, new bytes32[](0));
    }

    function testFuzzCommitmentChangesWithSalt(bytes32 saltA, bytes32 saltB) public {
        vm.assume(saltA != saltB);

        bytes32 first = election.computeCommitment(voter1, CANDIDATE_A, saltA);
        bytes32 second = election.computeCommitment(voter1, CANDIDATE_A, saltB);

        require(first != second, "commitments must differ for different salts");
    }

    function _proofFor(address voter) internal view returns (bytes32[] memory proof) {
        proof = new bytes32[](1);
        if (voter == voter1) {
            proof[0] = _leaf(voter2);
            return proof;
        }
        if (voter == voter2) {
            proof[0] = _leaf(voter1);
            return proof;
        }
        revert("unknown voter");
    }

    function _root() internal view returns (bytes32) {
        return _hashPair(_leaf(voter1), _leaf(voter2));
    }

    function _leaf(address voter) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(voter))));
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(bytes.concat(a, b)) : keccak256(bytes.concat(b, a));
    }
}
