const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { ZeroAddress, createCandidateId } = require("../../shared/simpleFlowCandidates");

describe("SimpleElectionFlow", function () {
  function buildCandidates() {
    return [
      {
        candidateId: createCandidateId("Alice", 0),
        displayName: "Alice",
        walletAddress: ZeroAddress,
      },
      {
        candidateId: createCandidateId("Bob", 1),
        displayName: "Bob",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
      {
        candidateId: createCandidateId("Charlie", 2),
        displayName: "Charlie",
        walletAddress: ZeroAddress,
      },
    ];
  }

  async function deployFixture() {
    const [owner, voter1, voter2] = await ethers.getSigners();
    const now = await time.latest();
    const startAt = now + 10;
    const endAt = startAt + 3600;
    const candidates = buildCandidates();

    const Factory = await ethers.getContractFactory("SimpleElectionFlow");
    const election = await Factory.deploy(
      owner.address,
      "Class President Demo",
      "Direct vote flow for UI testing.",
      startAt,
      endAt,
      candidates.map((candidate) => [
        candidate.candidateId,
        candidate.displayName,
        candidate.walletAddress,
      ])
    );
    await election.waitForDeployment();

    return { election, owner, voter1, voter2, startAt, endAt, candidates };
  }

  it("stores metadata and candidate list", async function () {
    const { election, candidates } = await deployFixture();
    expect(await election.title()).to.equal("Class President Demo");
    expect(await election.description()).to.equal("Direct vote flow for UI testing.");
    expect(await election.candidateCount()).to.equal(3n);
    expect(await election.getCandidateNames()).to.deep.equal(["Alice", "Bob", "Charlie"]);

    const [candidateIds, candidateNames, candidateWallets] = await election.getCandidates();
    expect(candidateIds).to.deep.equal(candidates.map((candidate) => candidate.candidateId));
    expect(candidateNames).to.deep.equal(candidates.map((candidate) => candidate.displayName));
    expect(candidateWallets).to.deep.equal(candidates.map((candidate) => candidate.walletAddress));
  });

  it("allows one direct vote per wallet during the active window", async function () {
    const { election, voter1, startAt, candidates } = await deployFixture();
    await time.increaseTo(startAt + 1);

    await expect(election.connect(voter1).castVote(1))
      .to.emit(election, "VoteCast")
      .withArgs(voter1.address, 1n, candidates[1].candidateId, "Bob", candidates[1].walletAddress, anyValue);

    const [candidateIds, candidateNames, candidateWallets, counts] = await election.getResults();
    expect(candidateIds).to.deep.equal(candidates.map((candidate) => candidate.candidateId));
    expect(candidateNames).to.deep.equal(["Alice", "Bob", "Charlie"]);
    expect(candidateWallets).to.deep.equal(candidates.map((candidate) => candidate.walletAddress));
    expect(counts.map((value) => Number(value))).to.deep.equal([0, 1, 0]);
    expect(await election.totalVotes()).to.equal(1n);
    expect(await election.hasVoted(voter1.address)).to.equal(true);
    expect(await election.votedCandidateIndexPlusOne(voter1.address)).to.equal(2n);

    await expect(election.connect(voter1).castVote(2)).to.be.revertedWithCustomError(
      election,
      "AlreadyVoted"
    );
  });

  it("rejects votes outside the active window", async function () {
    const { election, voter1, startAt, endAt } = await deployFixture();

    await expect(election.connect(voter1).castVote(0)).to.be.revertedWithCustomError(
      election,
      "InvalidStatus"
    );

    await time.increaseTo(startAt + 5);
    await expect(election.connect(voter1).castVote(0)).to.not.be.reverted;

    await time.increaseTo(endAt + 1);
    await expect(election.connect(voter1).castVote(1)).to.be.revertedWithCustomError(
      election,
      "InvalidStatus"
    );
  });

  it("rejects unknown candidates", async function () {
    const { election, voter2, startAt } = await deployFixture();
    await time.increaseTo(startAt + 1);

    await expect(election.connect(voter2).castVote(99)).to.be.revertedWithCustomError(
      election,
      "UnknownCandidate"
    );
  });

  it("rejects duplicate candidate ids", async function () {
    const [owner] = await ethers.getSigners();
    const now = await time.latest();
    const startAt = now + 10;
    const endAt = startAt + 3600;
    const duplicateId = createCandidateId("Alice", 0);

    const Factory = await ethers.getContractFactory("SimpleElectionFlow");
    await expect(
      Factory.deploy(owner.address, "Demo", "Test", startAt, endAt, [
        [duplicateId, "Alice", ZeroAddress],
        [duplicateId, "Bob", ZeroAddress],
      ])
    ).to.be.revertedWithCustomError(Factory, "DuplicateCandidateId");
  });
});
