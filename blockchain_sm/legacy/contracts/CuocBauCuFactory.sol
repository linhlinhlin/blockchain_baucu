// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./QuanLyCuocBauCu.sol";
import "./IQuanLyCuocBauCu.sol";
import "./IHoLiHuToken.sol";
import "./LibraryQuanLy.sol";
import "./IEntryPoint.sol";
import "./SimpleAccountNe.sol";
import "./HLUPaymaster.sol";




interface IHLUPaymaster {
    function withdrawHLU(address to, uint256 amount) external;
}

contract CuocBauCuFactory is AccessControl, ReentrancyGuard, Pausable {
    using EnumerableSet for EnumerableSet.UintSet;

    ProxyAdmin public proxyAdmin;
    LibraryQuanLy.QuanLyMapping private duLieuQuanLy;

    bytes32 public constant QUANTRI_HE_THONG = keccak256("QUANTRI_HE_THONG");
    bytes32 public constant QUANTRI_SERVER = keccak256("QUANTRI_SERVER");
    bytes32 public constant DIEU_TRA_VIEN = keccak256("DIEU_TRA_VIEN");
    bytes32 public constant KIEMDUYET_VIEN = keccak256("KIEMDUYET_VIEN");

    address public mauQuanLyCuocBauCu;
    address public quanLyPhieuBauToanCuc;
    address public quanLyThanhTuuToanCuc;
    IHoLiHuToken public hluToken;

    address public mauQuanLyCuocBauCuDangCho;
    address public quanLyPhieuBauToanCucDangCho;
    address public quanLyThanhTuuToanCucDangCho;
    uint128 public thoiGianKhoaCapNhat = 1 days;
    uint128 public yeuCauCapNhatCuoi;

    IEntryPoint public immutable entryPoint;
    address public immutable simpleAccountImplementation;
    address public immutable hluPaymaster;

    struct ThongTinCuocBauCu {
        address quanLyCuocBauCu;
        string tenCuocBauCu;
        string moTa;
        uint8 trangThai; // 0: hoạt động, 1: tạm dừng, 2: lưu trữ
        uint64 soLuongBaoCao;
        uint64 soLuongViPhamXacNhan;
        address nguoiTao;
    }
    mapping(uint128 => ThongTinCuocBauCu) public chiTietCuocBauCu;
    uint128 public idCuocBauCuTiepTheo = 1;
    uint128 public soLuongServerTonTai;
    EnumerableSet.UintSet private danhSachServerTonTai;
    mapping(address => EnumerableSet.UintSet) private serverCuaNguoiDung;

    uint256 public constant MOT_NGAY = 1 days;
    uint8 public constant gioiHanTrienKhaiMoiNgay = 5;
    mapping(address => uint8) public nonces;
    mapping(address => uint128) public ngayTrienKhaiCuoi;

    struct BaoCao {
        address nguoiBaoCao;
        string lyDo;
        bool daXuLy;
        uint128 thoiGian;
        string lyDoTuChoi;
    }
    mapping(uint128 => BaoCao[]) public baoCaoViPham;
    mapping(address => mapping(uint128 => uint8)) public soLuongBaoCaoTrongNgay;
    mapping(address => uint128) public ngayCuoiBaoCao;
    uint8 public constant GIOI_HAN_BAO_CAO_MOI_NGAY = 5;
    uint8 public constant NGUONG_VI_PHAM = 3;

    event ServerDaTao(uint128 indexed id, address indexed quanLyCuocBauCu, address indexed nguoiTao, string tenCuocBauCu);
    event CuocBauCuDaLuuTru(uint128 indexed id, address indexed quanLyCuocBauCu);
    event CuocBauCuDaTamDung(uint128 indexed id, string lyDo);
    event CuocBauCuDaKhoiPhuc(uint128 indexed id, address indexed nguoiKhoiPhuc);
    event VaiTroTrustSafetyDaCap(bytes32 indexed role, address indexed account);
    event VaiTroTrustSafetyDaThuHoi(bytes32 indexed role, address indexed account);
    event YeuCauCapNhatMau(address indexed nguoiYeuCau, address mauMoi, uint128 thoiGian);
    event MauDaCapNhat(address indexed mauQuanLyCuocBauCuMoi, address quanLyPhieuBauToanCucMoi, address quanLyThanhTuuToanCucMoi);
    event BaoCaoViPhamDaNhan(uint128 indexed idServer, address indexed nguoiBaoCao, string lyDo);
    event BaoCaoDaXuLy(uint128 indexed idServer, uint128 indexed idBaoCao, bool ketQua, string lyDoTuChoi);
    event HeThongDaTamDung(string lyDo);
    event HeThongDaTiepTuc();
    event ThoiGianKhoaCapNhatDaThayDoi(uint128 thoiGianMoi);
    event SimpleAccountDaTao(address indexed account, address indexed accountOwner);

   constructor(
        address _mauQuanLyCuocBauCu,
        address _quanLyPhieuBauToanCuc,
        address _quanLyThanhTuuToanCuc,
        address _hluToken,
        address _entryPoint,
        address _hluPaymaster,
        address nguoiKhoiTao
    ) {
        require(_mauQuanLyCuocBauCu != address(0) && _quanLyPhieuBauToanCuc != address(0) &&
                _quanLyThanhTuuToanCuc != address(0) && _hluToken != address(0) &&
                _entryPoint != address(0) && _hluPaymaster != address(0) && nguoiKhoiTao != address(0),
                "Invalid address");
        require(_hluToken.code.length > 0, "Invalid HLU Token");

        proxyAdmin = new ProxyAdmin();
        proxyAdmin.transferOwnership(nguoiKhoiTao);

        mauQuanLyCuocBauCu = _mauQuanLyCuocBauCu;
        quanLyPhieuBauToanCuc = _quanLyPhieuBauToanCuc;
        quanLyThanhTuuToanCuc = _quanLyThanhTuuToanCuc;
        hluToken = IHoLiHuToken(_hluToken);
        entryPoint = IEntryPoint(_entryPoint);
        hluPaymaster = _hluPaymaster;
        simpleAccountImplementation = address(new SimpleAccountNe(_entryPoint));

        _grantRole(QUANTRI_HE_THONG, nguoiKhoiTao);
        _grantRole(QUANTRI_SERVER, nguoiKhoiTao);
        _setRoleAdmin(QUANTRI_SERVER, QUANTRI_HE_THONG);
        _setRoleAdmin(DIEU_TRA_VIEN, QUANTRI_HE_THONG);
        _setRoleAdmin(KIEMDUYET_VIEN, QUANTRI_HE_THONG);
    }

    modifier chiQuanTriHeThong() {
        require(hasRole(QUANTRI_HE_THONG, msg.sender), "Only QUANTRI_HE_THONG");
        _;
    }

    modifier chiQuanTriServer() {
        require(hasRole(QUANTRI_SERVER, msg.sender), "Only QUANTRI_SERVER");
        _;
    }

    function taoSimpleAccountTrucTiep(bytes32 salt, address owner) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (address) 
    {
        // Kiểm tra implementation
        address implAddr = simpleAccountImplementation;
        uint256 implCodeSize;
        assembly { implCodeSize := extcodesize(implAddr) }
        require(implCodeSize > 0, "Implementation invalid");
        
        // Tạo initCode với Proxy
        bytes memory initCode = abi.encodePacked(
            type(TransparentUpgradeableProxy).creationCode,
            abi.encode(
                implAddr,
                address(this),  // Admin là Factory
                abi.encodeWithSelector(
                    SimpleAccountNe.initialize.selector, 
                    owner,  // Thay bytes32 bằng address
                    address(hluToken),
                    hluPaymaster
                )
            )
        );
        
        // Tính địa chỉ dự đoán
        address duDoanDiaChi = Create2.computeAddress(salt, keccak256(initCode));
        uint256 kichThuocMa;
        assembly { kichThuocMa := extcodesize(duDoanDiaChi) }
        require(kichThuocMa == 0, "Tai khoan da ton tai");
        
        // Triển khai SimpleAccount
        address diaChiDaTrienKhai = Create2.deploy(0, salt, initCode);
        
        // Kiểm tra triển khai
        require(diaChiDaTrienKhai != address(0), "Trien khai that bai");
        require(diaChiDaTrienKhai == duDoanDiaChi, "Dia chi khong khop");
        
        emit SimpleAccountDaTao(diaChiDaTrienKhai, msg.sender);
        return diaChiDaTrienKhai;
    }

    function doanDiaChiSimpleAccount(bytes32 salt, address owner) public view returns (address) {
        bytes memory initCode = abi.encodePacked(
            type(TransparentUpgradeableProxy).creationCode,
            abi.encode(
                simpleAccountImplementation, 
                address(this),  // Admin là factory
                abi.encodeWithSelector(
                    SimpleAccountNe.initialize.selector, 
                    owner,  // Thay bytes32 bằng address
                    address(hluToken),
                    hluPaymaster
                )
            )
        );
        
        return Create2.computeAddress(salt, keccak256(initCode));
    }

    function taoUserOpSimpleAccount(bytes32 salt, address owner)
        external
        view
        returns (IEntryPoint.UserOperation memory)
    {
        bytes memory initCode = abi.encodePacked(
            type(TransparentUpgradeableProxy).creationCode,
            abi.encode(
                simpleAccountImplementation,
                address(this),
                abi.encodeWithSelector(
                    SimpleAccountNe.initialize.selector,
                    owner,  // Thay bytes32 bằng address
                    address(hluToken),
                    hluPaymaster
                )
            )
        );
        address account = Create2.computeAddress(salt, keccak256(initCode));

        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: initCode,
            callData: "",
            callGasLimit: 100_000,
            verificationGasLimit: 150_000,
            preVerificationGas: 21_000,
            maxFeePerGas: block.basefee + 2 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(
                hluPaymaster,
                abi.encode(block.timestamp + 1 hours),
                abi.encode(block.timestamp)
            ),
            signature: ""
        });
    }
    
    function taoUserOpTrienKhaiServer(
        address account,
        string memory tenCuocBauCu,
        uint256 thoiGianKeoDai,
        string memory moTa
    ) external view returns (IEntryPoint.UserOperation memory) {
        bytes memory innerCallData = abi.encodeWithSelector(
            this.trienKhaiServer.selector,
            tenCuocBauCu,
            thoiGianKeoDai,
            moTa
        );

        bytes memory callData = abi.encodeWithSelector(
            SimpleAccountNe.execute.selector,
            address(this), // Gọi tới CuocBauCuFactory
            0,             // Không gửi ETH
            innerCallData  // Gọi trienKhaiServer
        );

        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: "",
            callData: callData,
            callGasLimit: 200_000,
            verificationGasLimit: 100_000,
            preVerificationGas: 21_000,
            maxFeePerGas: block.basefee + 1 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(
                hluPaymaster,
                abi.encode(block.timestamp + 1 hours),
                abi.encode(block.timestamp)
            ),
            signature: ""
        });
    }
    
    function trienKhaiServer(
        string memory tenCuocBauCu,
        uint256 thoiGianKeoDai,
        string memory moTa
    ) external whenNotPaused nonReentrant returns (uint128) {
        uint256 phiTao = 2 * 10**18;
        uint256 totalRequired = phiTao * 2;

        require(hluToken.balanceOf(msg.sender) >= totalRequired, "Insufficient HLU");
        require(hluToken.allowance(msg.sender, address(this)) >= totalRequired, "Need approval");

        uint128 ngayHienTai = uint128(block.timestamp);
        if (ngayHienTai >= ngayTrienKhaiCuoi[msg.sender] + MOT_NGAY) {
            nonces[msg.sender] = 0;
            ngayTrienKhaiCuoi[msg.sender] = ngayHienTai;
        }
        require(nonces[msg.sender] < gioiHanTrienKhaiMoiNgay, "Limit exceeded");

        require(hluToken.transferFrom(msg.sender, address(this), totalRequired), "Transfer failed");

        bytes memory initData = abi.encodeWithSelector(
            QuanLyCuocBauCu.initialize.selector,
            msg.sender,
            quanLyPhieuBauToanCuc,
            quanLyThanhTuuToanCuc,
            address(hluToken),
            address(entryPoint),
            tenCuocBauCu,
            thoiGianKeoDai
        );

        address proxy = address(new TransparentUpgradeableProxy(mauQuanLyCuocBauCu, address(proxyAdmin), initData));
        require(hluToken.transfer(proxy, phiTao), "Transfer to proxy failed");

        LibraryQuanLy.luuTrienKhai(duLieuQuanLy, proxy, quanLyPhieuBauToanCuc, quanLyThanhTuuToanCuc);

        uint128 idHienTai;
        unchecked {
            idHienTai = idCuocBauCuTiepTheo++;
            nonces[msg.sender]++;
            soLuongServerTonTai++;
        }

        chiTietCuocBauCu[idHienTai] = ThongTinCuocBauCu(proxy, tenCuocBauCu, moTa, 0, 0, 0, msg.sender);
        danhSachServerTonTai.add(idHienTai);
        serverCuaNguoiDung[msg.sender].add(idHienTai);

        emit ServerDaTao(idHienTai, proxy, msg.sender, tenCuocBauCu);
        return idHienTai;
    }

    function _tamDungCuocBauCuInternal(uint128 id, string memory lyDo) internal {
        require(id < idCuocBauCuTiepTheo, "Invalid ID");
        ThongTinCuocBauCu storage info = chiTietCuocBauCu[id];
        require(info.trangThai == 0, "Not active");

        info.trangThai = 1;
        unchecked { soLuongServerTonTai--; }
        danhSachServerTonTai.remove(id);
        emit CuocBauCuDaTamDung(id, lyDo);
    }

    function tamDungCuocBauCu(uint128 id, string memory lyDo) external chiQuanTriServer nonReentrant whenNotPaused {
        _tamDungCuocBauCuInternal(id, lyDo);
    }

    function guiBaoCaoViPham(uint128 idServer, string memory lyDo) external whenNotPaused {
        require(idServer < idCuocBauCuTiepTheo, "Invalid server");
        ThongTinCuocBauCu storage info = chiTietCuocBauCu[idServer];
        require(info.trangThai == 0, "Not active");

        uint128 ngayHienTai = uint128(block.timestamp / MOT_NGAY);
        if (ngayHienTai != ngayCuoiBaoCao[msg.sender]) {
            soLuongBaoCaoTrongNgay[msg.sender][ngayHienTai] = 0;
            ngayCuoiBaoCao[msg.sender] = ngayHienTai;
        }
        require(soLuongBaoCaoTrongNgay[msg.sender][ngayHienTai] < GIOI_HAN_BAO_CAO_MOI_NGAY, "Report limit exceeded");

        baoCaoViPham[idServer].push(BaoCao(msg.sender, lyDo, false, uint128(block.timestamp), ""));
        unchecked {
            soLuongBaoCaoTrongNgay[msg.sender][ngayHienTai]++;
            info.soLuongBaoCao++;
        }
        emit BaoCaoViPhamDaNhan(idServer, msg.sender, lyDo);
    }

    function xuLyBaoCao(uint128 idServer, uint128 idBaoCao, bool ketQua, string memory lyDoTuChoi)
        external chiQuanTriServer nonReentrant {
        require(idServer < idCuocBauCuTiepTheo, "Server not found");
        BaoCao storage baoCao = baoCaoViPham[idServer][idBaoCao];

        ThongTinCuocBauCu storage info = chiTietCuocBauCu[idServer];
        baoCao.daXuLy = true;
        unchecked { info.soLuongBaoCao--; }

        if (ketQua) {
            unchecked { info.soLuongViPhamXacNhan++; }
            if (info.soLuongViPhamXacNhan >= NGUONG_VI_PHAM && !paused()) {
                _tamDungCuocBauCuInternal(idServer, baoCao.lyDo);
            }
        } else {
            baoCao.lyDoTuChoi = lyDoTuChoi;
        }

        emit BaoCaoDaXuLy(idServer, idBaoCao, ketQua, lyDoTuChoi);
    }

    function capNhatImplementation(address proxy, address newImplementation)
        external chiQuanTriHeThong whenNotPaused {
        require(proxy.code.length > 0 && newImplementation != address(0) && newImplementation.code.length > 0, "Invalid address");
        try IQuanLyCuocBauCu(newImplementation).coPhienBauCuDangHoatDong() {} catch {}
        proxyAdmin.upgrade(ITransparentUpgradeableProxy(proxy), newImplementation);
        emit MauDaCapNhat(newImplementation, quanLyPhieuBauToanCuc, quanLyThanhTuuToanCuc);
    }

    function luuTruCuocBauCu(uint128 id) external chiQuanTriHeThong nonReentrant whenNotPaused {
        require(id < idCuocBauCuTiepTheo, "Invalid ID");
        ThongTinCuocBauCu storage info = chiTietCuocBauCu[id];
        require(info.trangThai == 0 && info.quanLyCuocBauCu != address(0), "Invalid server");
        require(!QuanLyCuocBauCu(info.quanLyCuocBauCu).coPhienBauCuDangHoatDong(), "Active election");

        info.trangThai = 2;
        unchecked { soLuongServerTonTai--; }
        danhSachServerTonTai.remove(id);
        LibraryQuanLy.xoaTrienKhai(duLieuQuanLy, info.quanLyCuocBauCu);

        emit CuocBauCuDaLuuTru(id, info.quanLyCuocBauCu);
    }

    function khoiPhucCuocBauCu(uint128 id) external chiQuanTriServer nonReentrant whenNotPaused {
        require(id < idCuocBauCuTiepTheo, "Invalid ID");
        ThongTinCuocBauCu storage info = chiTietCuocBauCu[id];
        require(info.trangThai == 1, "Not paused");

        info.trangThai = 0;
        unchecked { soLuongServerTonTai++; }
        danhSachServerTonTai.add(id);
        emit CuocBauCuDaKhoiPhuc(id, msg.sender);
    }

    function tamDungHeThong(string memory lyDo) external chiQuanTriHeThong {
        require(!paused(), "Already paused");
        _pause();
        emit HeThongDaTamDung(lyDo);
    }

    function tiepTucHeThong() external chiQuanTriHeThong {
        require(paused(), "Not paused");
        _unpause();
        emit HeThongDaTiepTuc();
    }

    function capNhatMauHopDong(address mauMoi, address phieuBauMoi, address thanhTuuMoi)
        external chiQuanTriHeThong whenNotPaused {
        require(mauMoi != address(0) || phieuBauMoi != address(0) || thanhTuuMoi != address(0), "Need at least one valid");
        require(block.timestamp >= yeuCauCapNhatCuoi + thoiGianKhoaCapNhat, "Update locked");
        require(mauQuanLyCuocBauCuDangCho == address(0) && quanLyPhieuBauToanCucDangCho == address(0) &&
                quanLyThanhTuuToanCucDangCho == address(0), "Pending update exists");

        uint128 thoiGianHienTai = uint128(block.timestamp);
        if (mauMoi != address(0)) {
            require(mauMoi.code.length > 0, "Invalid new template");
            try IQuanLyCuocBauCu(mauMoi).coPhienBauCuDangHoatDong() {} catch {}
            mauQuanLyCuocBauCuDangCho = mauMoi;
        }
        if (phieuBauMoi != address(0)) {
            require(phieuBauMoi.code.length > 0, "Invalid new vote");
            quanLyPhieuBauToanCucDangCho = phieuBauMoi;
        }
        if (thanhTuuMoi != address(0)) {
            require(thanhTuuMoi.code.length > 0, "Invalid new achievement");
            quanLyThanhTuuToanCucDangCho = thanhTuuMoi;
        }
        yeuCauCapNhatCuoi = thoiGianHienTai;
        emit YeuCauCapNhatMau(msg.sender, mauMoi, thoiGianHienTai);
    }

    function thucThiCapNhatMauHopDong() external chiQuanTriHeThong whenNotPaused {
        require(mauQuanLyCuocBauCuDangCho != address(0) || quanLyPhieuBauToanCucDangCho != address(0) || quanLyThanhTuuToanCucDangCho != address(0), "Chua co mau moi");
        require(block.timestamp >= yeuCauCapNhatCuoi + thoiGianKhoaCapNhat, "Chua het thoi gian khoa");

        if (mauQuanLyCuocBauCuDangCho != address(0)) {
            mauQuanLyCuocBauCu = mauQuanLyCuocBauCuDangCho;
            mauQuanLyCuocBauCuDangCho = address(0);
        }
        if (quanLyPhieuBauToanCucDangCho != address(0)) {
            quanLyPhieuBauToanCuc = quanLyPhieuBauToanCucDangCho;
            quanLyPhieuBauToanCucDangCho = address(0);
        }
        if (quanLyThanhTuuToanCucDangCho != address(0)) {
            quanLyThanhTuuToanCuc = quanLyThanhTuuToanCucDangCho;
            quanLyThanhTuuToanCucDangCho = address(0);
        }
        emit MauDaCapNhat(mauQuanLyCuocBauCu, quanLyPhieuBauToanCuc, quanLyThanhTuuToanCuc);
    }

    function thayDoiThoiGianKhoaCapNhat(uint128 thoiGianMoi) external chiQuanTriHeThong {
        require(thoiGianMoi >= 1 hours && thoiGianMoi <= 30 days && thoiGianMoi != thoiGianKhoaCapNhat, "Thoi gian khong hop le");
        thoiGianKhoaCapNhat = thoiGianMoi;
        emit ThoiGianKhoaCapNhatDaThayDoi(thoiGianMoi);
    }

    function layThongTinServer(uint128 id) external view returns (
        address quanLyCuocBauCu,
        string memory tenCuocBauCu,
        string memory moTa,
        uint8 trangThai,
        uint64 soLuongBaoCao,
        uint64 soLuongViPhamXacNhan,
        address nguoiTao
    ) {
        ThongTinCuocBauCu memory info = chiTietCuocBauCu[id];
        return (info.quanLyCuocBauCu, info.tenCuocBauCu, info.moTa, info.trangThai, info.soLuongBaoCao, info.soLuongViPhamXacNhan, info.nguoiTao);
    }

    function layDanhSachServerDangHoatDong() external pure returns (uint256[] memory) {
        revert("Use events for server list");
    }

    function layServerCuaNguoiDung(address nguoiDung) external view returns (uint256[] memory) {
        require(nguoiDung != address(0), "Invalid address");
        return serverCuaNguoiDung[nguoiDung].values();
    }

    function tonTaiServer(address server) external view returns (bool) {
        unchecked {
            for (uint128 i = 1; i < idCuocBauCuTiepTheo; i++) {
                ThongTinCuocBauCu memory info = chiTietCuocBauCu[i];
                if (info.quanLyCuocBauCu == server && info.trangThai == 0) return true;
            }
        }
        return false;
    }

    function kiemTraVaiTro(address account) external view returns (bytes32[] memory) {
        uint8 dem = 0;
        if (hasRole(QUANTRI_HE_THONG, account)) dem++;
        if (hasRole(QUANTRI_SERVER, account)) dem++;
        if (hasRole(DIEU_TRA_VIEN, account)) dem++;
        if (hasRole(KIEMDUYET_VIEN, account)) dem++;

        bytes32[] memory ketQua = new bytes32[](dem);
        uint8 index = 0;
        if (hasRole(QUANTRI_HE_THONG, account)) ketQua[index++] = QUANTRI_HE_THONG;
        if (hasRole(QUANTRI_SERVER, account)) ketQua[index++] = QUANTRI_SERVER;
        if (hasRole(DIEU_TRA_VIEN, account)) ketQua[index++] = DIEU_TRA_VIEN;
        if (hasRole(KIEMDUYET_VIEN, account)) ketQua[index++] = KIEMDUYET_VIEN;

        return ketQua;
    }

    function grantTrustSafetyRole(bytes32 role, address account) external chiQuanTriHeThong whenNotPaused {
        require(role == QUANTRI_SERVER || role == DIEU_TRA_VIEN || role == KIEMDUYET_VIEN, "Invalid role");
        require(account != address(0), "Invalid address");
        grantRole(role, account);
        emit VaiTroTrustSafetyDaCap(role, account);
    }

    function revokeTrustSafetyRole(bytes32 role, address account) external chiQuanTriHeThong whenNotPaused {
        require(role == QUANTRI_SERVER || role == DIEU_TRA_VIEN || role == KIEMDUYET_VIEN, "Invalid role");
        require(account != address(0), "Invalid address");
        revokeRole(role, account);
        emit VaiTroTrustSafetyDaThuHoi(role, account);
    }

    // Thêm các hàm để nhận ETH
    receive() external payable {}
    fallback() external payable {}
}