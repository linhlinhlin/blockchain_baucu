import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HoLiHuDeployment = buildModule("HoLiHuDeployment", (m) => {
  // Sử dụng 2 tài khoản có sẵn
  const admin = m.getAccount(0); // Tài khoản đầu tiên làm admin (deploy proxy và nguoiKhoiTao)
  const feeReceiver = m.getAccount(1); // Tài khoản thứ hai làm feeReceiver và gọi initialize

  // Bước 1: Deploy HoLiHuToken
  const hoLiHuToken = m.contract("HoLiHuToken", [admin, feeReceiver]);

  // Bước 2: Deploy EntryPoint
  const entryPoint = m.contract("EntryPoint", []);

  // Bước 3: Deploy HLUPaymaster
  const hluPaymaster = m.contract("HLUPaymaster", [entryPoint, hoLiHuToken], {
    after: [entryPoint, hoLiHuToken],
  });

  // Bước 4: Thêm HLUPaymaster vào whitelist của EntryPoint
  m.call(entryPoint, "themPaymaster", [hluPaymaster], {
    from: admin,
    after: [entryPoint, hluPaymaster],
  });

  // Bước 5: Deploy Master Copy cho QuanLyCuocBauCu
  const quanLyCuocBauCuImpl = m.contract("QuanLyCuocBauCu", []);
  const quanLyPhieuBauImpl = m.contract("QuanLyPhieuBauToanCuc", []);
  const quanLyThanhTuuImpl = m.contract("QuanLyThanhTuuToanCuc", []);

  // Bước 6: Deploy Proxy Toàn Cục
  const quanLyPhieuBauProxy = m.contract("TransparentUpgradeableProxy", [
    quanLyPhieuBauImpl,
    admin,
    "0x",
  ], {
    id: "QuanLyPhieuBauProxy",
    after: [quanLyPhieuBauImpl, hoLiHuToken],
  });

  const quanLyThanhTuuProxy = m.contract("TransparentUpgradeableProxy", [
    quanLyThanhTuuImpl,
    admin,
    "0x",
  ], {
    id: "QuanLyThanhTuuProxy",
    after: [quanLyThanhTuuImpl, quanLyPhieuBauProxy, hoLiHuToken],
  });

  // Bước 7: Deploy CuocBauCuFactory với constructor mới (7 tham số)
  const factory = m.contract("CuocBauCuFactory", [
    quanLyCuocBauCuImpl,    // _mauQuanLyCuocBauCu
    quanLyPhieuBauProxy,    // _quanLyPhieuBauToanCuc
    quanLyThanhTuuProxy,    // _quanLyThanhTuuToanCuc
    hoLiHuToken,            // _hluToken
    entryPoint,             // _entryPoint
    hluPaymaster,           // _hluPaymaster
    admin                   // nguoiKhoiTao
  ], {
    after: [
      quanLyCuocBauCuImpl,
      quanLyPhieuBauProxy,
      quanLyThanhTuuProxy,
      hoLiHuToken,
      entryPoint,
      hluPaymaster,
    ],
  });

  // Bước 8: Khởi tạo Proxy
  const phieuBauContract = m.contractAt("QuanLyPhieuBauToanCuc", quanLyPhieuBauProxy, {
    id: "PhieuBauContractInstance",
  });
  const thanhTuuContract = m.contractAt("QuanLyThanhTuuToanCuc", quanLyThanhTuuProxy, {
    id: "ThanhTuuContractInstance",
  });

  m.call(phieuBauContract, "initialize", [
    factory,
    quanLyThanhTuuProxy,
    hoLiHuToken,
    entryPoint,
    admin,
  ], {
    from: feeReceiver,
    after: [factory, quanLyThanhTuuProxy, hoLiHuToken, entryPoint],
  });

  m.call(thanhTuuContract, "initialize", [
    quanLyPhieuBauProxy,
    admin,
  ], {
    from: feeReceiver,
    after: [quanLyPhieuBauProxy, hoLiHuToken],
  });

  return {
    hoLiHuToken,
    entryPoint,
    hluPaymaster,
    quanLyCuocBauCuImpl,
    quanLyPhieuBauImpl,
    quanLyThanhTuuImpl,
    quanLyPhieuBauProxy,
    quanLyThanhTuuProxy,
    factory,
  };
});

export default HoLiHuDeployment;