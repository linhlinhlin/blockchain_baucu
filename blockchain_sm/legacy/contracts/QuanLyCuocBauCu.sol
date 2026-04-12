// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./IHoLiHuToken.sol";
import "./IQuanLyPhieuBauToanCuc.sol";
import "./IQuanLyCuocBauCu.sol";
import "./LibraryQuanLy.sol";
import "./IEntryPoint.sol";
import "./ICuocBauCuFactory.sol";

contract QuanLyCuocBauCu is AccessControlEnumerable, Initializable, IQuanLyCuocBauCu {
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    Counters.Counter private demSoCuocBauCu;
    Counters.Counter private demSoPhienBauCu;

    bytes32 public constant QUANTRI_HE_THONG = keccak256("QUANTRI_HE_THONG");
    bytes32 public constant QUANTRI_CUOCBAUCU = keccak256("QUANTRI_CUOCBAUCU");
    bytes32 public constant BANTOCHUC = keccak256("BANTOCHUC");

    uint256 public constant MIN_THOI_GIAN = 1 days;
    uint256 public constant MAX_THOI_GIAN = 30 days;
    uint256 public constant MAX_PHIEN_BAU_CU = 10;
    uint256 public constant THOI_GIAN_TRE_HUY = 1 days;
    uint256 public constant SO_LUONG_UNG_VIEN_TOI_DA = 50;
    uint256 public constant GIOI_HAN_SPAM_UNG_VIEN = 100;
    uint256 public constant PHI_TAO_CUOC_BAU_CU = 2 * 10**18; // 2 HLU
    uint256 public constant PHI_TAO_PHIEN = 1 * 10**18;      // 1 HLU
    uint256 public constant PHI_THEM_UNG_VIEN = 1 * 10**18;  // 1 HLU
    uint256 public constant NGUONG_XAC_NHAN_TAI_BAU = 66;    // 66%
    uint256 public constant THOI_HAN_BIEU_QUYET = 300;      // 5 phút (300 giây)
    uint256 public constant NGUONG_KET_THUC_SOM = 60;        // 60%

    mapping(uint256 => mapping(uint256 => uint256)) private nguongKetThucSomTuyChon;

    struct CuocBauCu {
        address nguoiSoHuu;
        bool dangHoatDong;
        uint256 thoiGianBatDau;
        uint256 thoiGianKetThuc;
        string tenCuocBauCu;
        uint256 phiHLU;
        mapping(uint256 => PhienBauCu) phienBauCu;
        EnumerableSet.UintSet danhSachPhienBauCu;
    }

    struct PhienBauCu {
        bool dangHoatDong;
        uint256 thoiGianBatDau;
        uint256 thoiGianKetThuc;
        uint256 soCuTriToiDa;
        EnumerableSet.AddressSet ungVien;
        EnumerableSet.AddressSet danhSachCuTri;
        mapping(address => uint256) soPhieu;
        address[] ungVienDacCu;
        bool taiBauCu;
        mapping(address => bool) xacNhanTaiBau;
        uint256 soLuongXacNhan;
        uint256 thoiGianHetHanXacNhan;
    }

    mapping(uint256 => CuocBauCu) private danhSachCuocBauCu;
    EnumerableSet.UintSet private danhSachIdCuocBauCuTonTai;
    IQuanLyPhieuBauToanCuc public quanLyPhieuBau;
    address public quanLyThanhTuuToanCuc;
    address public factory;
    address private diaChiProxy;

    IHoLiHuToken public hluToken;
    uint256 public quyDuTruHLU;

    IEntryPoint public entryPoint;

    // Định nghĩa các lỗi tùy chỉnh
    error NotAuthorized();
    error InvalidAddress();
    error InvalidTime();
    error ElectionNotFound();
    error SessionNotFound();
    error OperationNotAllowed(string reason);
    error InsufficientBalance();
    error TransferFailed();
    error AlreadyExists();
    error LimitExceeded();
    error VotingNotStarted();
    error VotingEnded();
    error NotVoter();
    error NotCandidate();
    error ConfirmationPeriodEnded();
    error NotEnoughConfirmations();
    error AlreadyConfirmed();
    error NoVotesCast();
    error InvalidInput(string message);

    // Các sự kiện giữ nguyên
    event CuocBauCuDaTao(uint256 indexed idCuocBauCu, address indexed nguoiSoHuu, uint256 thoiGianBatDau, uint256 thoiGianKetThuc);
    event CuocBauCuDaBatDau(uint256 indexed idCuocBauCu);
    event CuocBauCuDaKetThuc(uint256 indexed idCuocBauCu);
    event CuocBauCuDaHuy(uint256 indexed idCuocBauCu, string lyDo);
    event CuocBauCuDaXoa(uint256 indexed idCuocBauCu, address indexed quanTri);
    event PhienBauCuDaTao(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, address nguoiSoHuu);
    event PhienBauCuDaBatDau(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu);
    event PhienBauCuDaKetThuc(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, uint256 thoiGianKetThuc, address[] ungVienDacCu);
    event PhienBauCuDaHuy(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, string lyDo);
    event UngVienDaThem(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, address ungVien);
    event VaiTroDuocCap(bytes32 indexed vaiTro, address indexed taiKhoan);
    event VaiTroBiThuHoi(bytes32 indexed vaiTro, address indexed taiKhoan);
    event HLUTruPhi(address indexed nguoiDung, uint256 soLuong, string hanhDong);
    event HLUHoanTien(address indexed nguoiSoHuu, uint256 soLuong);
    event DebugLog(string message, address caller);
    event CuTriDaThem(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, address cuTri);
    event XacNhanTaiBauCu(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, address xacNhan);
    event TaiBauCuDaDuocDuyet(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu);
    event PhieuBauDaGhiNhan(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, address ungVien, uint256 soPhieu, address cuTri);
    event HoaPhieuBaoCao(uint256 indexed idCuocBauCu, uint256 indexed idPhienBauCu, uint256 soPhieuCaoNhat, uint256 soUngVienHoaPhieu);

    function initialize(
        address nguoiTao,
        address _quanLyPhieuBau,
        address _quanLyThanhTuuToanCuc,
        address _hluToken,
        address _entryPoint,
        string memory tenCuocBauCu,
        uint256 thoiGianKeoDai
    ) external initializer {
        if (nguoiTao == address(0)) revert InvalidAddress();
        if (_quanLyPhieuBau == address(0)) revert InvalidAddress();
        if (_quanLyThanhTuuToanCuc == address(0)) revert InvalidAddress();
        if (_hluToken == address(0)) revert InvalidAddress();
        if (_entryPoint == address(0)) revert InvalidAddress();
        if (thoiGianKeoDai < MIN_THOI_GIAN || thoiGianKeoDai > MAX_THOI_GIAN) revert InvalidTime();

        factory = msg.sender;
        _grantRole(QUANTRI_HE_THONG, factory);
        _grantRole(QUANTRI_CUOCBAUCU, nguoiTao);
        _setRoleAdmin(BANTOCHUC, QUANTRI_CUOCBAUCU);

        quanLyPhieuBau = IQuanLyPhieuBauToanCuc(_quanLyPhieuBau);
        quanLyThanhTuuToanCuc = _quanLyThanhTuuToanCuc;
        hluToken = IHoLiHuToken(_hluToken);
        entryPoint = IEntryPoint(_entryPoint);
        diaChiProxy = address(this);

        uint256 phiTao = PHI_TAO_CUOC_BAU_CU;

        demSoCuocBauCu.increment();
        uint256 idCuocBauCuMoi = demSoCuocBauCu.current();
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCuMoi];
        cuoc.nguoiSoHuu = nguoiTao;
        cuoc.dangHoatDong = false;
        cuoc.thoiGianBatDau = 0;
        cuoc.thoiGianKetThuc = 0;
        cuoc.tenCuocBauCu = tenCuocBauCu;
        cuoc.phiHLU = phiTao;
        danhSachIdCuocBauCuTonTai.add(idCuocBauCuMoi);

        quyDuTruHLU = phiTao;
        emit HLUTruPhi(nguoiTao, phiTao, "Tao cuoc bau cu");
        emit CuocBauCuDaTao(idCuocBauCuMoi, nguoiTao, 0, 0);
    }

    // Các modifier
    modifier chiQuanTriHeThong() {
        if (!hasRole(QUANTRI_HE_THONG, msg.sender)) revert NotAuthorized();
        _;
    }

    modifier chiQuanTriHoacPhieuBau() {
        if (!hasRole(QUANTRI_HE_THONG, msg.sender) && msg.sender != address(quanLyPhieuBau)) revert NotAuthorized();
        _;
    }

    modifier chiQuanTriCuocBauCu(uint256 idCuocBauCu) {
        if (!hasRole(QUANTRI_CUOCBAUCU, msg.sender) || danhSachCuocBauCu[idCuocBauCu].nguoiSoHuu != msg.sender) revert NotAuthorized();
        _;
    }

    modifier chiBanToChucHoacQuanTriCuocBauCu(uint256 idCuocBauCu) {
        if (!((hasRole(QUANTRI_CUOCBAUCU, msg.sender) && danhSachCuocBauCu[idCuocBauCu].nguoiSoHuu == msg.sender) || hasRole(BANTOCHUC, msg.sender))) revert NotAuthorized();
        _;
    }

    modifier chiQuanTriHoacPhieuBauHoacChuServer() {
        if (!hasRole(QUANTRI_HE_THONG, msg.sender) && msg.sender != address(quanLyPhieuBau) && !hasRole(QUANTRI_CUOCBAUCU, msg.sender)) revert NotAuthorized();
        _;
    }

    // Các hàm tạo UserOperation cho EIP-4337 (giữ nguyên)
    function taoUserOpTaoPhienBauCu(
        address account,
        uint256 idCuocBauCu,
        uint256 thoiGianKeoDai,
        uint256 soCuTriToiDa
    ) external view returns (IEntryPoint.UserOperation memory) {
        bytes memory callData = abi.encodeWithSelector(
            this.taoPhienBauCu.selector,
            idCuocBauCu,
            thoiGianKeoDai,
            soCuTriToiDa
        );
        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: "",
            callData: callData,
            callGasLimit: 200_000,
            verificationGasLimit: 100_000,
            preVerificationGas: 21_000,
            maxFeePerGas: 1 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(ICuocBauCuFactory(factory).hluPaymaster()),
            signature: ""
        });
    }

    function taoUserOpThemUngVien(
        address account,
        uint256 idCuocBauCu,
        uint256 idPhienBauCu,
        address ungVien
    ) external view returns (IEntryPoint.UserOperation memory) {
        bytes memory callData = abi.encodeWithSelector(
            this.themUngVien.selector,
            idCuocBauCu,
            idPhienBauCu,
            ungVien
        );
        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: "",
            callData: callData,
            callGasLimit: 200_000,
            verificationGasLimit: 100_000,
            preVerificationGas: 21_000,
            maxFeePerGas: 1 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(ICuocBauCuFactory(factory).hluPaymaster()),
            signature: ""
        });
    }

    function taoUserOpCapPhieuBauChoCuTri(
        address account,
        uint256 idCuocBauCu,
        uint256 idPhienBauCu,
        address cuTri,
        string calldata tokenURI
    ) external view returns (IEntryPoint.UserOperation memory) {
        bytes memory callData = abi.encodeWithSelector(
            this.capPhieuBauChoCuTri.selector,
            idCuocBauCu,
            idPhienBauCu,
            cuTri,
            tokenURI
        );
        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: "",
            callData: callData,
            callGasLimit: 200_000,
            verificationGasLimit: 100_000,
            preVerificationGas: 21_000,
            maxFeePerGas: 1 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(ICuocBauCuFactory(factory).hluPaymaster()),
            signature: ""
        });
    }

    function taoUserOpYeuCauTaiBauCu(
        address account,
        uint256 idCuocBauCu,
        uint256 idPhienBauCu
    ) external view returns (IEntryPoint.UserOperation memory) {
        bytes memory callData = abi.encodeWithSelector(
            this.yeuCauTaiBauCu.selector,
            idCuocBauCu,
            idPhienBauCu
        );
        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: "",
            callData: callData,
            callGasLimit: 200_000,
            verificationGasLimit: 100_000,
            preVerificationGas: 21_000,
            maxFeePerGas: 1 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(ICuocBauCuFactory(factory).hluPaymaster()),
            signature: ""
        });
    }

    function taoPhienBauCu(uint256 idCuocBauCu, uint256 thoiGianKeoDai, uint256 soCuTriToiDa)
        external override chiQuanTriCuocBauCu(idCuocBauCu) returns (uint256) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        if (!cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu chua bat dau");
        if (block.timestamp >= cuoc.thoiGianKetThuc) revert OperationNotAllowed("Cuoc bau cu da ket thuc");
        if (cuoc.danhSachPhienBauCu.length() >= MAX_PHIEN_BAU_CU) revert LimitExceeded();
        if (thoiGianKeoDai == 0) revert InvalidTime();

        if (hluToken.balanceOf(msg.sender) < PHI_TAO_PHIEN) revert InsufficientBalance();
        if (hluToken.allowance(msg.sender, address(this)) < PHI_TAO_PHIEN) revert OperationNotAllowed("Chua approve du HLU");
        bool success = hluToken.transferFrom(msg.sender, address(this), PHI_TAO_PHIEN);
        if (!success) revert TransferFailed();
        quyDuTruHLU += PHI_TAO_PHIEN;

        demSoPhienBauCu.increment();
        uint256 idPhienBauCuMoi = demSoPhienBauCu.current();

        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCuMoi];
        phien.dangHoatDong = false;
        phien.thoiGianBatDau = 0;
        phien.thoiGianKetThuc = 0;
        phien.soCuTriToiDa = soCuTriToiDa;

        cuoc.danhSachPhienBauCu.add(idPhienBauCuMoi);

        emit HLUTruPhi(msg.sender, PHI_TAO_PHIEN, "Tao phien bau cu");
        emit PhienBauCuDaTao(idCuocBauCu, idPhienBauCuMoi, msg.sender);
        return idPhienBauCuMoi;
    }

    function themUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu, address ungVien)
        external override chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!cuoc.danhSachPhienBauCu.contains(idPhienBauCu)) revert SessionNotFound();
        if (phien.dangHoatDong) revert OperationNotAllowed("Khong the them ung vien sau khi phien da bat dau");
        if (ungVien == address(0)) revert InvalidAddress();
        if (phien.ungVien.length() >= SO_LUONG_UNG_VIEN_TOI_DA) revert LimitExceeded();
        if (!phien.danhSachCuTri.contains(ungVien)) revert NotVoter();

        if (hluToken.balanceOf(msg.sender) < PHI_THEM_UNG_VIEN) revert InsufficientBalance();
        if (hluToken.allowance(msg.sender, address(this)) < PHI_THEM_UNG_VIEN) revert OperationNotAllowed("Chua approve du HLU");
        bool success = hluToken.transferFrom(msg.sender, address(this), PHI_THEM_UNG_VIEN);
        if (!success) revert TransferFailed();
        quyDuTruHLU += PHI_THEM_UNG_VIEN;

        if (!phien.ungVien.contains(ungVien)) {
            phien.ungVien.add(ungVien);
            emit HLUTruPhi(msg.sender, PHI_THEM_UNG_VIEN, "Them ung vien");
            emit UngVienDaThem(idCuocBauCu, idPhienBauCu, ungVien);
        }
    }

    function huyCuocBauCu(uint256 idCuocBauCu, string calldata lyDo) external override chiQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        if (!cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu khong hoat dong");
        if (coPhienBauCuDangHoatDongNoiBo(idCuocBauCu)) revert OperationNotAllowed("Van con phien bau cu dang hoat dong");
        if (block.timestamp < cuoc.thoiGianKetThuc + THOI_GIAN_TRE_HUY) revert OperationNotAllowed("Phai doi 24h sau khi ket thuc moi huy");

        uint256 phiHoanLai = cuoc.phiHLU;
        if (phiHoanLai > 0 && quyDuTruHLU >= phiHoanLai) {
            bool success = hluToken.transfer(cuoc.nguoiSoHuu, phiHoanLai);
            if (!success) revert TransferFailed();
            quyDuTruHLU -= phiHoanLai;
            cuoc.phiHLU = 0;
            emit HLUHoanTien(cuoc.nguoiSoHuu, phiHoanLai);
        }

        cuoc.dangHoatDong = false;
        emit CuocBauCuDaHuy(idCuocBauCu, lyDo);
    }

    function dangHoatDong(uint256 idCuocBauCu) external view override returns (bool) {
        return danhSachCuocBauCu[idCuocBauCu].dangHoatDong;
    }

    function tonTai(uint256 idCuocBauCu) external view override returns (bool) {
        return danhSachCuocBauCu[idCuocBauCu].nguoiSoHuu != address(0);
    }

    function layThongTinCuocBauCu(uint256 idCuocBauCu)
        external view override returns (address nguoiSoHuu, bool isDangHoatDong, uint256 thoiGianBatDau, uint256 thoiGianKetThuc) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        return (cuoc.nguoiSoHuu, cuoc.dangHoatDong, cuoc.thoiGianBatDau, cuoc.thoiGianKetThuc);
    }

    function layDanhSachPhienBauCu(uint256 idCuocBauCu, uint256 chiSoBatDau, uint256 gioiHan)
        external view override returns (uint256[] memory) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        uint256[] memory danhSach = cuoc.danhSachPhienBauCu.values();
        if (chiSoBatDau >= danhSach.length) revert InvalidInput("Chi so bat dau khong hop le");

        uint256 chiSoKetThuc = chiSoBatDau + gioiHan > danhSach.length ? danhSach.length : chiSoBatDau + gioiHan;
        uint256[] memory ketQua = new uint256[](chiSoKetThuc - chiSoBatDau);

        for (uint256 i = chiSoBatDau; i < chiSoKetThuc; i++) {
            ketQua[i - chiSoBatDau] = danhSach[i];
        }
        return ketQua;
    }

    function coPhienBauCuDangHoatDong() external view override returns (bool) {
        uint256[] memory ids = danhSachIdCuocBauCuTonTai.values();
        for (uint256 i = 0; i < ids.length; i++) {
            if (coPhienBauCuDangHoatDongNoiBo(ids[i])) {
                return true;
            }
        }
        return false;
    }

    function coPhienBauCuDangHoatDongNoiBo(uint256 idCuocBauCu) internal view returns (bool) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        uint256[] memory phienIds = cuoc.danhSachPhienBauCu.values();
        for (uint256 i = 0; i < phienIds.length; i++) {
            PhienBauCu storage phien = cuoc.phienBauCu[phienIds[i]];
            if (phien.dangHoatDong && block.timestamp <= phien.thoiGianKetThuc) {
                return true;
            }
        }
        return false;
    }

    function batDauCuocBauCu(uint256 idCuocBauCu, uint256 thoiGianKeoDai) external override chiQuanTriCuocBauCu(idCuocBauCu) {
        if (thoiGianKeoDai < MIN_THOI_GIAN || thoiGianKeoDai > MAX_THOI_GIAN) revert InvalidTime();
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        if (cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu da bat dau");

        cuoc.dangHoatDong = true;
        cuoc.thoiGianBatDau = block.timestamp;
        cuoc.thoiGianKetThuc = block.timestamp + thoiGianKeoDai;

        emit CuocBauCuDaBatDau(idCuocBauCu);
    }

    function ketThucCuocBauCu(uint256 idCuocBauCu) external override chiQuanTriCuocBauCu(idCuocBauCu) {
        ketThucCuocBauCuNoiBo(idCuocBauCu);
    }

    function xoaCuocBauCu(uint256 idCuocBauCu) external override chiQuanTriHeThong {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        if (cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu van dang hoat dong, phai ket thuc truoc");
        if (coPhienBauCuDangHoatDongNoiBo(idCuocBauCu)) revert OperationNotAllowed("Van con phien bau cu dang hoat dong");

        delete danhSachCuocBauCu[idCuocBauCu];
        danhSachIdCuocBauCuTonTai.remove(idCuocBauCu);

        emit CuocBauCuDaXoa(idCuocBauCu, msg.sender);
    }

    function ketThucCuocBauCuNoiBo(uint256 idCuocBauCu) internal {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        if (!cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu khong hoat dong");
        if (coPhienBauCuDangHoatDongNoiBo(idCuocBauCu)) revert OperationNotAllowed("Van con phien bau cu dang hoat dong");

        cuoc.dangHoatDong = false;
        emit CuocBauCuDaKetThuc(idCuocBauCu);
    }

    function batDauPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu, uint256 thoiGianKeoDai)
        external override chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (!cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu khong hoat dong");
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien da bat dau");
        if (thoiGianKeoDai == 0) revert InvalidTime();

        phien.dangHoatDong = true;
        phien.thoiGianBatDau = block.timestamp;
        phien.thoiGianKetThuc = block.timestamp + thoiGianKeoDai;

        emit PhienBauCuDaBatDau(idCuocBauCu, idPhienBauCu);
    }

    function ketThucPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external override chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        ketThucPhienBauCuNoiBo(idCuocBauCu, idPhienBauCu);
    }

    function tuDongKetThucPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external override {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!phien.dangHoatDong) revert OperationNotAllowed("Phien khong hoat dong");
        if (block.timestamp < phien.thoiGianKetThuc) revert OperationNotAllowed("Chua den thoi gian ket thuc");

        ketThucPhienBauCuNoiBo(idCuocBauCu, idPhienBauCu);
    }

    function canKetThucPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
        external view returns (bool) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        return phien.dangHoatDong && block.timestamp >= phien.thoiGianKetThuc;
    }

    function canKetThucSomPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
        external view returns (bool) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        
        if (!phien.dangHoatDong) return false;
        
        uint256 tongSoCuTri = phien.danhSachCuTri.length();
        if (tongSoCuTri == 0) return false;
        
        uint256 tongSoPhieuDaBo = 0;
        address[] memory danhSachUngVien = phien.ungVien.values();
        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            tongSoPhieuDaBo += phien.soPhieu[danhSachUngVien[i]];
        }
        
        uint256 tyLeThamGia = (tongSoPhieuDaBo * 100) / tongSoCuTri;
        
        uint256 nguongApDung = nguongKetThucSomTuyChon[idCuocBauCu][idPhienBauCu];
        if (nguongApDung == 0) {
            nguongApDung = NGUONG_KET_THUC_SOM;
        }
        
        return tyLeThamGia >= nguongApDung;
    }

    function ketThucSomPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        if (!this.canKetThucSomPhienBauCu(idCuocBauCu, idPhienBauCu)) 
            revert OperationNotAllowed("Chua du dieu kien ket thuc som");
        
        ketThucPhienBauCuNoiBo(idCuocBauCu, idPhienBauCu);
    }

    function tatCaCuTriDaBoPhieu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
        public view returns (bool) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        
        if (!phien.dangHoatDong) return false;
        
        uint256 tongSoCuTri = phien.danhSachCuTri.length();
        if (tongSoCuTri == 0) return false;
        
        uint256 tongSoPhieuDaBo = 0;
        address[] memory danhSachUngVien = phien.ungVien.values();
        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            tongSoPhieuDaBo += phien.soPhieu[danhSachUngVien[i]];
        }
        
        return tongSoPhieuDaBo >= tongSoCuTri;
    }

    function ketThucPhienKhiBoPhieuDayDu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external {
        if (!tatCaCuTriDaBoPhieu(idCuocBauCu, idPhienBauCu)) 
            revert OperationNotAllowed("Chua tat ca cu tri bo phieu");
        
        ketThucPhienBauCuNoiBo(idCuocBauCu, idPhienBauCu);
    }

    function thietLapNguongKetThucSom(uint256 idCuocBauCu, uint256 idPhienBauCu, uint256 nguongMoi)
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        if (nguongMoi < 50 || nguongMoi > 100) revert InvalidInput("Nguong phai tu 50% den 100%");
        nguongKetThucSomTuyChon[idCuocBauCu][idPhienBauCu] = nguongMoi;
    }

    function ketThucPhienBauCuNoiBo(uint256 idCuocBauCu, uint256 idPhienBauCu) internal {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!phien.dangHoatDong) revert OperationNotAllowed("Phien khong hoat dong");

        address[] memory danhSachUngVien = phien.ungVien.values();
        uint256 soPhieuCaoNhat = 0;

        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            if (phien.soPhieu[danhSachUngVien[i]] > soPhieuCaoNhat) {
                soPhieuCaoNhat = phien.soPhieu[danhSachUngVien[i]];
            }
        }

        if (soPhieuCaoNhat == 0) revert NoVotesCast();

        uint256 count = 0;
        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            if (phien.soPhieu[danhSachUngVien[i]] == soPhieuCaoNhat) {
                count++;
            }
        }
        address[] memory ungVienDacCu = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            if (phien.soPhieu[danhSachUngVien[i]] == soPhieuCaoNhat) {
                ungVienDacCu[index] = danhSachUngVien[i];
                index++;
            }
        }

        if (count > 1) {
            emit HoaPhieuBaoCao(idCuocBauCu, idPhienBauCu, soPhieuCaoNhat, count);
        }

        phien.ungVienDacCu = ungVienDacCu;
        phien.dangHoatDong = false;
        phien.thoiGianHetHanXacNhan = block.timestamp + THOI_HAN_BIEU_QUYET;
        quanLyPhieuBau.thuHoiNFTKhiPhienKetThuc(idCuocBauCu, idPhienBauCu);

        emit PhienBauCuDaKetThuc(idCuocBauCu, idPhienBauCu, block.timestamp, ungVienDacCu);
    }

    function xacNhanTaiBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) external {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien van dang hoat dong");
        if (phien.ungVienDacCu.length == 0) revert OperationNotAllowed("Chua co ket qua bau cu");
        if (phien.taiBauCu) revert OperationNotAllowed("Da yeu cau tai bau cu truoc do");
        if (block.timestamp > phien.thoiGianHetHanXacNhan) revert ConfirmationPeriodEnded();
        if (phien.xacNhanTaiBau[msg.sender]) revert AlreadyConfirmed();

        bool laBanToChuc = hasRole(BANTOCHUC, msg.sender);
        bool laCuTriNe = phien.danhSachCuTri.contains(msg.sender);
        uint256 soBanToChuc = getRoleMemberCount(BANTOCHUC);

        if (soBanToChuc > 0) {
            if (!laBanToChuc) revert NotAuthorized();
        } else {
            if (!laCuTriNe) revert NotVoter();
        }

        phien.xacNhanTaiBau[msg.sender] = true;
        phien.soLuongXacNhan += 1;

        emit XacNhanTaiBauCu(idCuocBauCu, idPhienBauCu, msg.sender);
    }

    function yeuCauTaiBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external chiQuanTriCuocBauCu(idCuocBauCu) returns (uint256) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien van dang hoat dong");
        if (phien.ungVienDacCu.length == 0) revert OperationNotAllowed("Chua co ket qua bau cu");
        if (phien.taiBauCu) revert OperationNotAllowed("Da yeu cau tai bau cu truoc do");
        if (!cuoc.dangHoatDong) revert OperationNotAllowed("Cuoc bau cu khong hoat dong");
        if (cuoc.danhSachPhienBauCu.length() >= MAX_PHIEN_BAU_CU) revert LimitExceeded();

        uint256 soBanToChuc = getRoleMemberCount(BANTOCHUC);
        uint256 tongSoNguoiBieuQuyet;
        uint256 nguong;

        if (soBanToChuc > 0) {
            tongSoNguoiBieuQuyet = soBanToChuc;
        } else {
            tongSoNguoiBieuQuyet = phien.danhSachCuTri.length();
            if (tongSoNguoiBieuQuyet == 0) revert OperationNotAllowed("Khong co cu tri nao");
        }

        nguong = (tongSoNguoiBieuQuyet * NGUONG_XAC_NHAN_TAI_BAU + 99) / 100;
        if (phien.soLuongXacNhan < nguong) revert NotEnoughConfirmations();

        if (hluToken.balanceOf(msg.sender) < PHI_TAO_PHIEN) revert InsufficientBalance();
        if (hluToken.allowance(msg.sender, address(this)) < PHI_TAO_PHIEN) revert OperationNotAllowed("Chua approve du HLU");
        bool success = hluToken.transferFrom(msg.sender, address(this), PHI_TAO_PHIEN);
        if (!success) revert TransferFailed();
        quyDuTruHLU += PHI_TAO_PHIEN;

        demSoPhienBauCu.increment();
        uint256 idPhienBauCuMoi = demSoPhienBauCu.current();

        PhienBauCu storage phienMoi = cuoc.phienBauCu[idPhienBauCuMoi];
        phienMoi.dangHoatDong = false;
        phienMoi.thoiGianBatDau = 0;
        phienMoi.thoiGianKetThuc = 0;
        phienMoi.soCuTriToiDa = phien.soCuTriToiDa;
        for (uint256 i = 0; i < phien.ungVienDacCu.length; i++) {
            phienMoi.ungVien.add(phien.ungVienDacCu[i]);
        }

        cuoc.danhSachPhienBauCu.add(idPhienBauCuMoi);
        phien.taiBauCu = true;

        emit HLUTruPhi(msg.sender, PHI_TAO_PHIEN, "Tao phien tai bau cu");
        emit PhienBauCuDaTao(idCuocBauCu, idPhienBauCuMoi, msg.sender);
        emit TaiBauCuDaDuocDuyet(idCuocBauCu, idPhienBauCu);
        return idPhienBauCuMoi;
    }

    function huyPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu, string calldata lyDo)
        external override chiQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!phien.dangHoatDong) revert OperationNotAllowed("Phien khong hoat dong");

        phien.dangHoatDong = false;
        quanLyPhieuBau.thuHoiNFTKhiPhienKetThuc(idCuocBauCu, idPhienBauCu);
        delete cuoc.phienBauCu[idPhienBauCu];
        emit PhienBauCuDaHuy(idCuocBauCu, idPhienBauCu, lyDo);
    }

    function themCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address cuTri)
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!cuoc.danhSachPhienBauCu.contains(idPhienBauCu)) revert SessionNotFound();
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien da bat dau, khong the them cu tri");
        if (phien.danhSachCuTri.length() >= phien.soCuTriToiDa) revert LimitExceeded();
        if (phien.danhSachCuTri.contains(cuTri)) revert AlreadyExists();

        phien.danhSachCuTri.add(cuTri);
        emit CuTriDaThem(idCuocBauCu, idPhienBauCu, cuTri);
    }

    function capPhieuBauChoCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address cuTri, string calldata tokenURI)
        external override chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!phien.dangHoatDong) revert OperationNotAllowed("Phien khong hoat dong");
        if (!phien.danhSachCuTri.contains(cuTri)) revert NotVoter();

        emit DebugLog("trc khi ggoii capPhieuBau", msg.sender);
        quanLyPhieuBau.capPhieuBau(cuTri, idCuocBauCu, idPhienBauCu, tokenURI);
        emit DebugLog("Sau khi gi capPhieuBau", msg.sender);
    }

    function ghiNhanPhieuBau(uint256 idCuocBauCu, uint256 idPhienBauCu, address ungVien, uint256 soPhieu)
        external override {
        if (msg.sender != address(quanLyPhieuBau)) revert NotAuthorized();
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!phien.dangHoatDong) revert OperationNotAllowed("Phien khong hoat dong");
        if (block.timestamp > phien.thoiGianKetThuc) revert VotingEnded();
        if (!phien.ungVien.contains(ungVien)) revert NotCandidate();
        phien.soPhieu[ungVien] += soPhieu;

        emit PhieuBauDaGhiNhan(idCuocBauCu, idPhienBauCu, ungVien, soPhieu, tx.origin);
    }

    function layKetQuaPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external view returns (address[] memory ungVien, uint256[] memory soPhieu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien van dang hoat dong, chua co ket qua");

        address[] memory danhSachUngVien = phien.ungVien.values();
        uint256[] memory ketQuaPhieu = new uint256[](danhSachUngVien.length);

        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            ketQuaPhieu[i] = phien.soPhieu[danhSachUngVien[i]];
        }

        return (danhSachUngVien, ketQuaPhieu);
    }

    function chuyenQuyenQuanTriCuocBauCu(uint256 idCuocBauCu, address nguoiSoHuuMoi) 
        external override chiQuanTriCuocBauCu(idCuocBauCu) {
        if (nguoiSoHuuMoi == address(0)) revert InvalidAddress();
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();

        revokeRole(QUANTRI_CUOCBAUCU, cuoc.nguoiSoHuu);
        emit VaiTroBiThuHoi(QUANTRI_CUOCBAUCU, cuoc.nguoiSoHuu);

        grantRole(QUANTRI_CUOCBAUCU, nguoiSoHuuMoi);
        emit VaiTroDuocCap(QUANTRI_CUOCBAUCU, nguoiSoHuuMoi);

        cuoc.nguoiSoHuu = nguoiSoHuuMoi;
    }

    function themBanToChuc(address banToChuc) external override {
        if (!hasRole(QUANTRI_CUOCBAUCU, msg.sender) && !hasRole(QUANTRI_HE_THONG, msg.sender)) revert NotAuthorized();
        grantRole(BANTOCHUC, banToChuc);
        emit VaiTroDuocCap(BANTOCHUC, banToChuc);
    }

    function xoaBanToChuc(address banToChuc) external override {
        if (!hasRole(QUANTRI_CUOCBAUCU, msg.sender) && !hasRole(QUANTRI_HE_THONG, msg.sender)) revert NotAuthorized();
        revokeRole(BANTOCHUC, banToChuc);
        emit VaiTroBiThuHoi(BANTOCHUC, banToChuc);
    }

    function soLuongCuocBauCuTonTai() external view override returns (uint256) {
        return danhSachIdCuocBauCuTonTai.length();
    }

    function layDanhSachIdTonTai() external view override returns (uint256[] memory) {
        return danhSachIdCuocBauCuTonTai.values();
    }

    function layDanhSachUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external view override returns (address[] memory) {
        return danhSachCuocBauCu[idCuocBauCu].phienBauCu[idPhienBauCu].ungVien.values();
    }

    function laCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address cuTri)
        external view override returns (bool) {
        return danhSachCuocBauCu[idCuocBauCu].phienBauCu[idPhienBauCu].danhSachCuTri.contains(cuTri);
    }

    function laPhienHoatDong(uint256 idCuocBauCu, uint256 idPhienBauCu) external view override returns (bool) {
        return danhSachCuocBauCu[idCuocBauCu].phienBauCu[idPhienBauCu].dangHoatDong;
    }

    function laySoPhieuUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu, address ungVien)
        external view override returns (uint256) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        return cuoc.phienBauCu[idPhienBauCu].soPhieu[ungVien];
    }

    function layDanhSachUngVienDacCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external view returns (address[] memory) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        return cuoc.phienBauCu[idPhienBauCu].ungVienDacCu;
    }
    
    function layThongTinCoBan(uint256 idCuocBauCu) external view returns (
        address nguoiSoHuu,
        bool dangHoatDongDay,
        uint256 thoiGianBatDau,
        uint256 thoiGianKetThuc,
        string memory tenCuocBauCu,
        uint256 phiHLU
    ) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        return (
            cuoc.nguoiSoHuu,
            cuoc.dangHoatDong,
            cuoc.thoiGianBatDau,
            cuoc.thoiGianKetThuc,
            cuoc.tenCuocBauCu,
            cuoc.phiHLU
        );
    }

    function layThongTinPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
        external view returns (
            bool dangHoatDongNe,
            uint256 thoiGianBatDau,
            uint256 thoiGianKetThuc,
            uint256 soCuTriToiDa,
            uint256 soUngVienHienTai,
            uint256 soCuTriHienTai,
            address[] memory ungVienDacCu,
            bool taiBauCu,
            uint256 soLuongXacNhan,
            uint256 thoiGianHetHanXacNhan
        ) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        return (
            phien.dangHoatDong,
            phien.thoiGianBatDau,
            phien.thoiGianKetThuc,
            phien.soCuTriToiDa,
            phien.ungVien.length(),
            phien.danhSachCuTri.length(),
            phien.ungVienDacCu,
            phien.taiBauCu,
            phien.soLuongXacNhan,
            phien.thoiGianHetHanXacNhan
        );
    }

    function thuHoiNFTKhiPhienKetThuc(uint256 idCuocBauCu, uint256 idPhienBauCu) 
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        if (cuoc.nguoiSoHuu == address(0)) revert ElectionNotFound();
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien van dang hoat dong, phai ket thuc truoc");

        quanLyPhieuBau.thuHoiNFTKhiPhienKetThuc(idCuocBauCu, idPhienBauCu);
    }

    function themNhieuCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address[] calldata danhSachCuTri)
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!cuoc.danhSachPhienBauCu.contains(idPhienBauCu)) revert SessionNotFound();
        if (phien.dangHoatDong) revert OperationNotAllowed("Phien da bat dau, khong the them cu tri");
        
        uint256 soLuongHienTai = phien.danhSachCuTri.length();
        if (soLuongHienTai + danhSachCuTri.length > phien.soCuTriToiDa) revert LimitExceeded();
        
        for (uint256 i = 0; i < danhSachCuTri.length; i++) {
            address cuTri = danhSachCuTri[i];
            if (cuTri == address(0)) revert InvalidAddress();
            
            if (!phien.danhSachCuTri.contains(cuTri)) {
                phien.danhSachCuTri.add(cuTri);
                emit CuTriDaThem(idCuocBauCu, idPhienBauCu, cuTri);
            }
        }
    }

    function themNhieuUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu, address[] calldata danhSachUngVien)
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!cuoc.danhSachPhienBauCu.contains(idPhienBauCu)) revert SessionNotFound();
        if (phien.dangHoatDong) revert OperationNotAllowed("Khong the them ung vien sau khi phien da bat dau");
        
        uint256 soLuongHienTai = phien.ungVien.length();
        if (soLuongHienTai + danhSachUngVien.length > SO_LUONG_UNG_VIEN_TOI_DA) revert LimitExceeded();
        
        uint256 phiTong = PHI_THEM_UNG_VIEN * danhSachUngVien.length;
        if (hluToken.balanceOf(msg.sender) < phiTong) revert InsufficientBalance();
        if (hluToken.allowance(msg.sender, address(this)) < phiTong) revert OperationNotAllowed("Chua approve du HLU");
        bool success = hluToken.transferFrom(msg.sender, address(this), phiTong);
        if (!success) revert TransferFailed();
        quyDuTruHLU += phiTong;
        
        for (uint256 i = 0; i < danhSachUngVien.length; i++) {
            address ungVien = danhSachUngVien[i];
            if (ungVien == address(0)) revert InvalidAddress();
            if (!phien.danhSachCuTri.contains(ungVien)) revert NotVoter();
            
            if (!phien.ungVien.contains(ungVien)) {
                phien.ungVien.add(ungVien);
                emit UngVienDaThem(idCuocBauCu, idPhienBauCu, ungVien);
            }
        }
        
        emit HLUTruPhi(msg.sender, phiTong, "Them nhieu ung vien");
    }

    function capPhieuBauChoNhieuCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address[] calldata danhSachCuTri, string[] calldata tokenURIs)
        external chiBanToChucHoacQuanTriCuocBauCu(idCuocBauCu) {
        if (danhSachCuTri.length != tokenURIs.length) revert InvalidInput("So luong cu tri va tokenURI khong khop");
        CuocBauCu storage cuoc = danhSachCuocBauCu[idCuocBauCu];
        PhienBauCu storage phien = cuoc.phienBauCu[idPhienBauCu];
        if (!phien.dangHoatDong) revert OperationNotAllowed("Phien khong hoat dong");
        
        for (uint256 i = 0; i < danhSachCuTri.length; i++) {
            address cuTri = danhSachCuTri[i];
            string memory tokenURI = tokenURIs[i];
            
            if (!phien.danhSachCuTri.contains(cuTri)) revert NotVoter();
            quanLyPhieuBau.capPhieuBau(cuTri, idCuocBauCu, idPhienBauCu, tokenURI);
        }
    }
}