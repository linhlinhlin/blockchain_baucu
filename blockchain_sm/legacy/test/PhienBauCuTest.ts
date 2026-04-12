import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { PhienBauCu } from "../typechain-types";

describe("PhienBauCu", function () {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let phienBauCu: PhienBauCu;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const PhienBauCuContract = await ethers.getContractFactory("PhienBauCu");
    phienBauCu = await PhienBauCuContract.deploy("Phiên Bầu Cử 1", owner.address, 3600);
    await phienBauCu.waitForDeployment();
  });

  it("Nên thêm cử tri thành công", async () => {
    await phienBauCu.themCuTri(user.address);
    const coQuyenBau = await phienBauCu.danhSachCuTri(user.address);
    expect(coQuyenBau).to.equal(true);
  });

  it("Nên thêm ứng viên thành công", async () => {
    await phienBauCu.themUngVien(owner.address);
    const ungVien = await phienBauCu.layDanhSachUngVien();
    expect(ungVien[0]).to.equal(owner.address);
  });

  it("Nên bỏ phiếu thành công", async () => {
    await phienBauCu.themCuTri(user.address);
    await phienBauCu.themUngVien(owner.address);
    await phienBauCu.connect(user).bauChon(owner.address);
    const soPhieu = await phienBauCu.layKetQua(owner.address);
    expect(soPhieu).to.equal(1);
  });

  it("Không thể bỏ phiếu hai lần", async () => {
    await phienBauCu.themCuTri(user.address);
    await phienBauCu.themUngVien(owner.address);
    await phienBauCu.connect(user).bauChon(owner.address);
    await expect(phienBauCu.connect(user).bauChon(owner.address)).to.be.revertedWith("Ban khong co quyen bau!");
  });

  it("Không thể bỏ phiếu sau khi đóng", async () => {
    await phienBauCu.dongPhienBauCu();
    await expect(phienBauCu.connect(user).bauChon(owner.address)).to.be.revertedWith("Phien bau cu da dong!");
  });

  it("Không thể thêm cử tri với địa chỉ không hợp lệ", async () => {
    await expect(phienBauCu.themCuTri("0x0000000000000000000000000000000000000000")).to.be.revertedWith("Dia chi khong hop le!");
  });

  it("Không thể thêm ứng viên với địa chỉ không hợp lệ", async () => {
    await expect(phienBauCu.themUngVien("0x0000000000000000000000000000000000000000")).to.be.revertedWith("Dia chi ung vien khong hop le!");
  });

  it("Nên tự động đóng phiên bầu cử khi quá hạn", async () => {
    // Tăng thời gian của blockchain để vượt qua thời gian kết thúc của phiên bầu cử
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    // Gọi hàm để kích hoạt modifier phienConHoatDong
    await phienBauCu.kiemTraVaDongPhien();

    // Kiểm tra trạng thái của phiên bầu cử
    const trangThai = await phienBauCu.dangHoatDong();
    expect(trangThai).to.equal(false);
  });
});