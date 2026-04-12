import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("HoLiHuToken", () => {
  let HoLiHuToken: any;
  let token: Contract;
  let owner: Signer;
  let creator: Signer;
  let voter1: Signer;
  let voter2: Signer;
  let candidate1: Signer;
  let candidate2: Signer;
  let mod1: Signer;
  let mod2: Signer;
  let anyone: Signer;

  beforeEach(async () => {
    // Lấy các tài khoản từ Hardhat
    [owner, creator, voter1, voter2, candidate1, candidate2, mod1, mod2, anyone] = await ethers.getSigners();

    // Deploy hợp đồng HoLiHuToken
    HoLiHuToken = await ethers.getContractFactory("HoLiHuToken");
    token = await HoLiHuToken.deploy();
    await token.waitForDeployment();

    // Gán role ELECTION_CREATOR_ROLE cho creator
    await token.connect(owner).themElectionCreator(await creator.getAddress());
  });

  // Test khởi tạo hợp đồng
  it("should initialize with correct roles", async () => {
    expect(await token.hasRole(await token.ADMIN_ROLE(), await owner.getAddress())).to.be.true;
    expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.true;
    expect(await token.hasRole(await token.ELECTION_CREATOR_ROLE(), await creator.getAddress())).to.be.true;
  });

  // Test tạo cuộc bầu cử
  it("should create an election", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    const status = await token.getElectionStatus(1);
    expect(status.isActive).to.be.true;
    expect(status.owner).to.equal(await creator.getAddress());
    expect(status.maxVoters).to.equal(10n);
  });

  it("should prevent duplicate election ID", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await expect(
      token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image2.jpg", "ipfs://metadata2.json")
    ).to.be.revertedWith("Election da duoc tao");
  });

  it("should enforce creation cooldown", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await expect(
      token.connect(creator).kichHoatPhienBauCu(2, 3600, 10, "ipfs://image2.jpg", "ipfs://metadata2.json")
    ).to.be.revertedWith("Chua duoc tao cuoc bau cu moi");
  });

  it("should limit elections per user", async () => {
    for (let i = 1; i <= 5; i++) {
      await token.connect(creator).kichHoatPhienBauCu(i, 3600, 10, `ipfs://image${i}.jpg`, `ipfs://metadata${i}.json`);
      await ethers.provider.send("evm_increaseTime", [86400]); // Tăng 1 ngày
      await ethers.provider.send("evm_mine", []);
    }
    await expect(
      token.connect(creator).kichHoatPhienBauCu(6, 3600, 10, "ipfs://image6.jpg", "ipfs://metadata6.json")
    ).to.be.revertedWith("Ban da vuot qua gioi han tao cuoc bau cu");
  });

  // Test thêm ứng viên
  it("should add a candidate", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).themUngVien(1, await candidate1.getAddress());
    const status = await token.getElectionStatus(1);
    expect(status.candidateCount).to.equal(1n);
  });

  it("should not add duplicate candidates", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).themUngVien(1, await candidate1.getAddress());
    await token.connect(creator).themUngVien(1, await candidate1.getAddress()); // Gọi lần thứ hai
    const status = await token.getElectionStatus(1);
    expect(status.candidateCount).to.equal(1n); // Chỉ thêm một lần
  });

  // Test cấp phiếu bầu
  it("should issue a voting NFT", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).capPhieuBau(await voter1.getAddress(), 1);
    expect(await token.ownerOf(1)).to.equal(await voter1.getAddress());
    expect(await token.userVotes(1, await voter1.getAddress())).to.equal(1n);
  });

  it("should limit votes per user", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).capPhieuBau(await voter1.getAddress(), 1);
    await expect(token.connect(creator).capPhieuBau(await voter1.getAddress(), 1)).to.be.revertedWith("Da dat gioi han phieu bau");
  });

  // Test bỏ phiếu
  it("should allow voting", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).themUngVien(1, await candidate1.getAddress());
    await token.connect(creator).capPhieuBau(await voter1.getAddress(), 1);
    await token.connect(voter1).boPhieu(1, 1, await candidate1.getAddress());
    expect(await token.kiemTraKetQua(1, await candidate1.getAddress())).to.equal(1n);
  });

  it("should prevent double voting", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).themUngVien(1, await candidate1.getAddress());
    await token.connect(creator).capPhieuBau(await voter1.getAddress(), 1);
    await token.connect(voter1).boPhieu(1, 1, await candidate1.getAddress());
    await expect(token.connect(voter1).boPhieu(1, 1, await candidate1.getAddress())).to.be.revertedWith("Token khong ton tai");
  });

  // Test kết thúc phiên
  it("should end an election", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).themUngVien(1, await candidate1.getAddress());
    await token.connect(creator).capPhieuBau(await voter1.getAddress(), 1);
    await token.connect(voter1).boPhieu(1, 1, await candidate1.getAddress());

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    await token.connect(creator).ketThucPhienBauCu(1);
    const status = await token.getElectionStatus(1);
    expect(status.isActive).to.be.false;
    expect(status.isFinalized).to.be.true;
  });

  // Test tự động kết thúc phiên
  it("should auto end an election", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    await token.connect(anyone).autoEndElection(1);
    const status = await token.getElectionStatus(1);
    expect(status.isActive).to.be.false;
    expect(status.isFinalized).to.be.true;
  });

  it("should prevent spam autoEndElection", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    await token.connect(anyone).autoEndElection(1);
    await expect(token.connect(anyone).autoEndElection(1)).to.be.revertedWith("Phien da duoc tu dong ket thuc");
  });

  // Test hủy phiên
  it("should cancel an election", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).huyPhienBauCu(1, "Test cancel");
    const status = await token.getElectionStatus(1);
    expect(status.isActive).to.be.false;
    expect(status.isFinalized).to.be.true;
  });

  // Test bật/tắt trạng thái
  it("should toggle election status", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).huyPhienBauCu(1, "Test disable");

    let status = await token.getElectionStatus(1);
    expect(status.isDisabled).to.be.false;

    await token.connect(creator).toggleElectionStatus(1, true);
    status = await token.getElectionStatus(1);
    expect(status.isDisabled).to.be.true;

    await token.connect(creator).toggleElectionStatus(1, false);
    status = await token.getElectionStatus(1);
    expect(status.isDisabled).to.be.false;
  });

  // Test thêm Moderator
  it("should add and remove moderators", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).addModerator(1, await mod1.getAddress());
    const moderators = await token.getModerators(1, [await mod1.getAddress(), await mod2.getAddress()]);
    expect(moderators).to.include(await mod1.getAddress());

    await token.connect(creator).removeModerator(1, await mod1.getAddress());
    const updatedModerators = await token.getModerators(1, [await mod1.getAddress(), await mod2.getAddress()]);
    expect(updatedModerators).to.not.include(await mod1.getAddress());
  });

  // Test chuyển quyền sở hữu
  it("should transfer election ownership", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).transferElectionOwnership(1, await anyone.getAddress());
    const status = await token.getElectionStatus(1);
    expect(status.owner).to.equal(await anyone.getAddress());
  });

  // Test vòng bỏ phiếu thứ hai (Runoff Election)
  it("should initiate runoff election", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    await token.connect(creator).themUngVien(1, await candidate1.getAddress());
    await token.connect(creator).themUngVien(1, await candidate2.getAddress());
    await token.connect(creator).capPhieuBau(await voter1.getAddress(), 1);
    await token.connect(creator).capPhieuBau(await voter2.getAddress(), 1);
    await token.connect(voter1).boPhieu(1, 1, await candidate1.getAddress());
    await token.connect(voter2).boPhieu(2, 1, await candidate2.getAddress());

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    await token.connect(creator).ketThucPhienBauCu(1);
    await token.connect(creator).initiateRunoffElection(1);

    const status = await token.getElectionStatus(2); // newElectionId = 2
    expect(status.isActive).to.be.true;
    expect(status.candidateCount).to.equal(2n);
  });

  // Test reset election count
  it("should reset election count by admin", async () => {
    await token.connect(creator).kichHoatPhienBauCu(1, 3600, 10, "ipfs://image.jpg", "ipfs://metadata.json");
    expect(await token.electionCount(await creator.getAddress())).to.equal(1n);

    await token.connect(owner).resetElectionCount(await creator.getAddress());
    expect(await token.electionCount(await creator.getAddress())).to.equal(0n);
  });
});