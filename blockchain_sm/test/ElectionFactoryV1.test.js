const { expect } = require("chai");
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

describe("ElectionFactoryV1", function () {
  async function deployFixture() {
    const [owner, creator, admin, voter1, voter2, outsider] =
      await ethers.getSigners();

    const candidateA = ethers.id("candidate-a");
    const candidateB = ethers.id("candidate-b");

    const voters = [[voter1.address], [voter2.address]];
    const merkleTree = StandardMerkleTree.of(voters, ["address"]);

    const Factory = await ethers.getContractFactory("ElectionFactoryV1");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    await factory.setCreatorAuthorization(creator.address, true);

    const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    const config = {
      admin: admin.address,
      electionURI: "ipfs://holihu/elections/class-president-2026",
      electionMetadataHash: ethers.id("class-president-2026-manifest"),
      eligibleVotersRoot: merkleTree.root,
      commitStart: Number(now + 10n),
      commitEnd: Number(now + 110n),
      revealEnd: Number(now + 210n),
      candidateIds: [candidateA, candidateB],
      minReveals: 0,
      enforceQuorum: false,
    };

    return {
      owner,
      creator,
      admin,
      voter1,
      voter2,
      outsider,
      candidateA,
      candidateB,
      merkleTree,
      voters,
      factory,
      config,
    };
  }

  it("deploys immutable elections through the factory", async function () {
    const { creator, factory, config } = await deployFixture();

    const tx = await factory.connect(creator).createElection(config);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");

    expect(await factory.electionCount()).to.equal(1n);
    expect(event.args.admin).to.equal(config.admin);
    expect(event.args.metadataHash).to.equal(config.electionMetadataHash);
    expect(event.args.electionAddress).to.properAddress;
  });

  it("rejects unauthorized creators", async function () {
    const { outsider, factory, config } = await deployFixture();

    await expect(factory.connect(outsider).createElection(config)).to.be.revertedWithCustomError(
      factory,
      "CreatorNotAuthorized"
    );
  });

  it("supports commit, reveal and finalize for eligible voters only", async function () {
    const { creator, voter1, voter2, outsider, candidateA, candidateB, merkleTree, factory, config } =
      await deployFixture();

    const createTx = await factory.connect(creator).createElection(config);
    const createReceipt = await createTx.wait();
    const createEvent = createReceipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");

    const electionAddress = createEvent.args.electionAddress;
    const election = await ethers.getContractAt("ElectionV1", electionAddress);

    await ethers.provider.send("evm_setNextBlockTimestamp", [config.commitStart]);
    await ethers.provider.send("evm_mine");

    const salt1 = ethers.id("voter-1-secret");
    const salt2 = ethers.id("voter-2-secret");
    const commitment1 = await election.computeCommitment(voter1.address, candidateA, salt1);
    const commitment2 = await election.computeCommitment(voter2.address, candidateB, salt2);

    await expect(
      election.connect(outsider).commitVote(commitment1, [])
    ).to.be.revertedWithCustomError(election, "NotEligible");

    await election.connect(voter1).commitVote(
      commitment1,
      merkleTree.getProof(0)
    );

    await election.connect(voter2).commitVote(
      commitment2,
      merkleTree.getProof(1)
    );

    await expect(
      election.connect(voter1).commitVote(
        commitment1,
        merkleTree.getProof(0)
      )
    ).to.be.revertedWithCustomError(election, "AlreadyCommitted");

    await ethers.provider.send("evm_setNextBlockTimestamp", [config.commitEnd]);
    await ethers.provider.send("evm_mine");

    await election.connect(voter1).revealVote(candidateA, salt1);
    await election.connect(voter2).revealVote(candidateB, salt2);

    await expect(
      election.connect(voter1).revealVote(candidateA, salt1)
    ).to.be.revertedWithCustomError(election, "AlreadyRevealed");

    const [candidateIds, counts] = await election.getResults();
    expect(candidateIds[0]).to.equal(candidateA);
    expect(candidateIds[1]).to.equal(candidateB);
    expect(counts[0]).to.equal(1n);
    expect(counts[1]).to.equal(1n);

    await ethers.provider.send("evm_setNextBlockTimestamp", [config.revealEnd + 1]);
    await ethers.provider.send("evm_mine");

    await election.finalizeElection();
    expect(await election.finalized()).to.equal(true);
  });

  it("rejects invalid candidate reveal data", async function () {
    const { creator, voter1, candidateA, factory, config, merkleTree } = await deployFixture();

    const createTx = await factory.connect(creator).createElection(config);
    const createReceipt = await createTx.wait();
    const createEvent = createReceipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");

    const election = await ethers.getContractAt("ElectionV1", createEvent.args.electionAddress);

    await ethers.provider.send("evm_setNextBlockTimestamp", [config.commitStart]);
    await ethers.provider.send("evm_mine");

    const salt = ethers.id("voter-1-secret");
    const commitment = await election.computeCommitment(voter1.address, candidateA, salt);

    await election.connect(voter1).commitVote(commitment, merkleTree.getProof(0));

    await ethers.provider.send("evm_setNextBlockTimestamp", [config.commitEnd]);
    await ethers.provider.send("evm_mine");

    await expect(
      election.connect(voter1).revealVote(candidateA, ethers.id("wrong-salt"))
    ).to.be.revertedWithCustomError(election, "CommitmentMismatch");
  });

  it("allows owner to cancel only before commit starts", async function () {
    const { creator, admin, factory, config } = await deployFixture();

    const createTx = await factory.connect(creator).createElection(config);
    const createReceipt = await createTx.wait();
    const createEvent = createReceipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");

    const election = await ethers.getContractAt("ElectionV1", createEvent.args.electionAddress);
    const reasonHash = ethers.id("configuration-error");

    await election.connect(admin).cancelElection(reasonHash);
    expect(await election.canceled()).to.equal(true);
    expect(await election.cancellationReasonHash()).to.equal(reasonHash);
  });

  it("rejects invalid election configuration", async function () {
    const { creator, factory, config } = await deployFixture();

    const invalidConfig = {
      ...config,
      candidateIds: [config.candidateIds[0], config.candidateIds[0]],
    };

    await expect(
      factory.connect(creator).createElection(invalidConfig)
    ).to.be.reverted;
  });

  it("prevents finalization before the reveal period ends", async function () {
    const { creator, factory, config } = await deployFixture();

    const createTx = await factory.connect(creator).createElection(config);
    const createReceipt = await createTx.wait();
    const createEvent = createReceipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");

    const election = await ethers.getContractAt("ElectionV1", createEvent.args.electionAddress);

    await expect(election.finalizeElection()).to.be.revertedWithCustomError(
      election,
      "InvalidPhase"
    );
  });

  it("S9 enforceQuorum=true: revert finalize khi reveal < minReveals", async function () {
    const { creator, factory, config } = await deployFixture();
    const quorumConfig = { ...config, minReveals: 1, enforceQuorum: true };

    const createTx = await factory.connect(creator).createElection(quorumConfig);
    const createReceipt = await createTx.wait();
    const createEvent = createReceipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");
    const election = await ethers.getContractAt("ElectionV1", createEvent.args.electionAddress);

    expect(await election.minReveals()).to.equal(1n);
    expect(await election.enforceQuorum()).to.equal(true);

    await ethers.provider.send("evm_setNextBlockTimestamp", [quorumConfig.revealEnd + 1]);
    await ethers.provider.send("evm_mine");

    await expect(election.finalizeElection()).to.be.revertedWithCustomError(
      election,
      "QuorumNotReached"
    );
    expect(await election.finalized()).to.equal(false);
  });

  it("S9 enforceQuorum=false: finalize set lowTurnout khi reveal < minReveals", async function () {
    const { creator, factory, config } = await deployFixture();
    const quorumConfig = { ...config, minReveals: 5, enforceQuorum: false };

    const createTx = await factory.connect(creator).createElection(quorumConfig);
    const createReceipt = await createTx.wait();
    const createEvent = createReceipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "ElectionCreated");
    const election = await ethers.getContractAt("ElectionV1", createEvent.args.electionAddress);

    await ethers.provider.send("evm_setNextBlockTimestamp", [quorumConfig.revealEnd + 1]);
    await ethers.provider.send("evm_mine");

    await expect(election.finalizeElection())
      .to.emit(election, "LowTurnout")
      .withArgs(0n, 5n);
    expect(await election.finalized()).to.equal(true);
    expect(await election.lowTurnout()).to.equal(true);
  });
});
