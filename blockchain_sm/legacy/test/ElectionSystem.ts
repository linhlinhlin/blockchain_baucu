import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

describe("Election System Tests", function () {
  let factory: Contract;
  let cuocBauCu: Contract;
  let phienBauCu: Contract;
  let phieuBau: Contract;
  let thanhTuu: Contract;
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;

  // Setup trước mỗi test
  beforeEach(async function () {
    [deployer, admin, voter1, voter2] = await ethers.getSigners();

    // Deploy CuocBauCuFactory
    const CuocBauCuFactory = await ethers.getContractFactory("CuocBauCuFactory");
    factory = await CuocBauCuFactory.deploy();
    await factory.deployed();

    // Tạo một cuộc bầu cử mới
    await factory.taoCuocBauCu();
    const contracts = await factory.getElectionContracts(1);

    // Kết nối tới các hợp đồng con
    cuocBauCu = await ethers.getContractAt("QuanLyCuocBauCu", contracts.quanLyCuocBauCu);
    phienBauCu = await ethers.getContractAt("QuanLyPhienBauCu", contracts.quanLyPhienBauCu);
    phieuBau = await ethers.getContractAt("QuanLyPhieuBau", contracts.quanLyPhieuBau);
    thanhTuu = await ethers.getContractAt("QuanLyThanhTuu", contracts.quanLyThanhTuu);

    // Gán vai trò admin cho deployer nếu cần
    await cuocBauCu.grantRole(await cuocBauCu.ADMIN_ROLE(), deployer.address);
    await phienBauCu.grantRole(await phienBauCu.DEFAULT_ADMIN_ROLE(), deployer.address);
  });

  // Test Case 1: Kiểm tra triển khai Factory và hợp đồng con
  describe("CuocBauCuFactory Deployment", function () {
    it("Tạo cuộc bầu cử mới và kiểm tra địa chỉ hợp đồng", async function () {
      const contracts = await factory.getElectionContracts(1);
      expect(contracts.quanLyCuocBauCu).to.not.equal(ethers.constants.AddressZero);
      expect(contracts.quanLyPhienBauCu).to.not.equal(ethers.constants.AddressZero);
      expect(contracts.quanLyPhieuBau).to.not.equal(ethers.constants.AddressZero);
      expect(contracts.quanLyThanhTuu).to.not.equal(ethers.constants.AddressZero);
      expect(await factory.electionCounter()).to.equal(1);
    });

    it("Kiểm tra quyền giao tiếp giữa các hợp đồng", async function () {
      const phienBauCuRole = await phieuBau.PHIEN_BAU_CU_ROLE();
      const phieuBauRole = await thanhTuu.PHIEU_BAU_ROLE();
      expect(await phieuBau.hasRole(phienBauCuRole, phienBauCu.address)).to.be.true;
      expect(await thanhTuu.hasRole(phieuBauRole, phieuBau.address)).to.be.true;
    });
  });

  // Test Case 2: Kiểm tra QuanLyCuocBauCu
  describe("QuanLyCuocBauCu Tests", function () {
    it("Tạo và bắt đầu cuộc bầu cử thành công", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60); // 1 ngày
      const cuoc = await cuocBauCu.cuocBauCus(1);
      expect(cuoc.owner).to.equal(deployer.address);
      expect(cuoc.active).to.be.false;

      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      const cuocStarted = await cuocBauCu.cuocBauCus(1);
      expect(cuocStarted.active).to.be.true;
      expect(cuocStarted.startTime).to.not.equal(0);
    });

    it("Thất bại khi non-admin tạo cuộc bầu cử", async function () {
      await expect(cuocBauCu.connect(voter1).taoCuocBauCu(1 * 24 * 60 * 60)).to.be.revertedWith(
        "Chi admin duoc phep goi"
      );
    });

    it("Kết thúc cuộc bầu cử khi hết thời gian", async function () {
      await cuocBauCu.taoCuocBauCu(60); // 60 giây
      await cuocBauCu.batDauCuocBauCu(1, 60);
      await ethers.provider.send("evm_increaseTime", [61]); // Tăng thời gian
      await ethers.provider.send("evm_mine", []);
      await cuocBauCu.ketThucCuocBauCu(1);
      const cuoc = await cuocBauCu.cuocBauCus(1);
      expect(cuoc.active).to.be.false;
    });
  });

  // Test Case 3: Kiểm tra QuanLyPhienBauCu
  describe("QuanLyPhienBauCu Tests", function () {
    it("Tạo và bắt đầu phiên bầu cử thành công", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60); // 15 phút
      
      const phien = await phienBauCu.phienBauCus(1);
      expect(phien.owner).to.equal(deployer.address);
      expect(phien.active).to.be.false;

      await phienBauCu.batDauPhienBauCu(1);
      const phienStarted = await phienBauCu.phienBauCus(1);
      expect(phienStarted.active).to.be.true;
    });

    it("Thêm ứng viên thành công", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60);
      await phienBauCu.batDauPhienBauCu(1);

      await phienBauCu.themUngVien(1, voter1.address);
      const phien = await phienBauCu.phienBauCus(1);
      expect(phien.candidates[0]).to.equal(voter1.address);
    });

    it("Thất bại khi thêm ứng viên khi phiên chưa bắt đầu", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60);

      await expect(phienBauCu.themUngVien(1, voter1.address)).to.be.revertedWith("Phien khong hoat dong");
    });
  });

  // Test Case 4: Kiểm tra QuanLyPhieuBau
  describe("QuanLyPhieuBau Tests", function () {
    it("Cấp và sử dụng phiếu bầu thành công", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60);
      await phienBauCu.batDauPhienBauCu(1);

      await phienBauCu.capPhieuBauChoCuTri(1, voter1.address);
      expect(await phieuBau.ownerOf(1)).to.equal(voter1.address);

      await phieuBau.connect(voter1).boPhieu(1, 1);
      await expect(phieuBau.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
      expect(await phieuBau.hasVoted(1, voter1.address)).to.be.true;
    });

    it("Thất bại khi non-owner bỏ phiếu", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60);
      await phienBauCu.batDauPhienBauCu(1);

      await phienBauCu.capPhieuBauChoCuTri(1, voter1.address);
      await expect(phieuBau.connect(voter2).boPhieu(1, 1)).to.be.revertedWith("Ban khong so huu phieu nay");
    });

    it("Thất bại khi cố chuyển nhượng phiếu bầu", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60);
      await phienBauCu.batDauPhienBauCu(1);

      await phienBauCu.capPhieuBauChoCuTri(1, voter1.address);
      await expect(
        phieuBau.connect(voter1).transferFrom(voter1.address, voter2.address, 1)
      ).to.be.revertedWith("Phieu bau khong the chuyen nhuong");
    });
  });

  // Test Case 5: Kiểm tra QuanLyThanhTuu
  describe("QuanLyThanhTuu Tests", function () {
    it("Cấp thành tựu theo cấp bậc", async function () {
      await cuocBauCu.taoCuocBauCu(1 * 24 * 60 * 60);
      await cuocBauCu.batDauCuocBauCu(1, 1 * 24 * 60 * 60);
      await cuocBauCu.themPhienBauCu(1, 15 * 60);
      await phienBauCu.batDauPhienBauCu(1);

      // Lần 1: Bronze
      await phienBauCu.capPhieuBauChoCuTri(1, voter1.address);
      await phieuBau.connect(voter1).boPhieu(1, 1);
      expect(await thanhTuu.ownerOf(1)).to.equal(voter1.address);
      expect(await thanhTuu.tokenURI(1)).to.equal("ipfs://bronze.json");

      // Tạo phiên mới để bỏ phiếu lần 2
      await cuocBauCu.themPhienBauCu(1, 15 * 60);
      await phienBauCu.batDauPhienBauCu(2);
      await phienBauCu.capPhieuBauChoCuTri(2, voter1.address);
      await phieuBau.connect(voter1).boPhieu(2, 2);
      expect(await thanhTuu.tokenURI(2)).to.equal("ipfs://bronze.json");

      // Kiểm tra participationCount
      const [count] = await thanhTuu.kiemTraThanhTuu(voter1.address);
      expect(count).to.equal(2);
    });

    it("Thất bại khi non-PhieuBau gọi capThanhTuu", async function () {
      await expect(thanhTuu.connect(voter1).capThanhTuu(voter1.address, 1)).to.be.revertedWith(
        "AccessControl: account"
      );
    });
  });
});