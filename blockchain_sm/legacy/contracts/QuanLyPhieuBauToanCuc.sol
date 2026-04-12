// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./IHoLiHuToken.sol";
import "./IQuanLyThanhTuuToanCuc.sol";
import "./IQuanLyCuocBauCu.sol";
import "./ICuocBauCuFactory.sol";
import "./IEntryPoint.sol";

contract QuanLyPhieuBauToanCuc is Initializable, ERC721URIStorageUpgradeable, OwnableUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using Counters for Counters.Counter;
    Counters.Counter private demSoToken;

    bytes32 public constant QUANTRI_HE_THONG = keccak256("QUANTRI_HE_THONG");
    bytes32 public constant QUANTRI_CUOCBAUCU = keccak256("QUANTRI_CUOCBAUCU");

    IQuanLyThanhTuu public quanLyThanhTuu;
    IHoLiHuToken public hluToken;
    ICuocBauCuFactory public factory;
    IEntryPoint public entryPoint; // Thêm EntryPoint

    uint256 public constant SO_PHIEU_TOI_DA_MOI_NGUOI = 1;
    uint256 public constant PHI_BO_PHIEU = 3 * 10**18; // 3 HLU
    uint256 public constant PHI_TAO_PHIEN = 2 * 10**18;

    mapping(address => mapping(uint256 => mapping(address => bool))) public daNhanNFTNay;
    mapping(uint256 => uint256) public tokenDenPhienBauCuNay;
    mapping(uint256 => uint256) public tokenDenCuocBauCuNay;
    mapping(uint256 => address) public nguoiSoHuuTokenNay;
    mapping(address => mapping(uint256 => mapping(uint256 => mapping(address => bool)))) public daBoPhieuPhienNay;
    mapping(uint256 => uint256) public thoiGianBoPhieuNay;
    mapping(uint256 => mapping(uint256 => uint256)) public tokenCuaPhien;
    mapping(uint256 => uint256[]) public danhSachTokenCuaPhien;

    event PhieuBauDaCap(address indexed cuTri, uint256 idToken, uint256 idCuocBauCu, uint256 idPhienBauCu, string uriToken);
    event PhieuDaBo(uint256 indexed serverId, uint256 indexed idPhienBauCu, address indexed cuTri, uint256 idToken, address ungVien, uint256 thoiGian);
    event NFTDaThuHoi(uint256 indexed idToken, address indexed nguoiThuHoi);

    function initialize(
        address diaChiFactory,
        address diaChiQuanLyThanhTuu,
        address diaChiHLUToken,
        address diaChiEntryPoint, // Thêm EntryPoint
        address nguoiKhoiTao
    ) external initializer {
        require(diaChiFactory != address(0) && diaChiFactory.code.length > 0, "Dia chi Factory khong hop le");
        require(diaChiQuanLyThanhTuu != address(0) && diaChiQuanLyThanhTuu.code.length > 0, "Dia chi QuanLyThanhTuu khong hop le");
        require(diaChiHLUToken != address(0) && diaChiHLUToken.code.length > 0, "Dia chi HLU Token khong hop le");
        require(diaChiEntryPoint != address(0) && diaChiEntryPoint.code.length > 0, "Dia chi EntryPoint khong hop le");
        require(nguoiKhoiTao != address(0), "Dia chi nguoi khoi tao khong hop le");

        __ERC721_init("HoLiHu Phieu Bau", "HLU-PB");
        __ERC721URIStorage_init();
        __Ownable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        _transferOwnership(nguoiKhoiTao);
        _grantRole(QUANTRI_HE_THONG, nguoiKhoiTao);
        _setRoleAdmin(QUANTRI_CUOCBAUCU, QUANTRI_HE_THONG);

        factory = ICuocBauCuFactory(diaChiFactory);
        quanLyThanhTuu = IQuanLyThanhTuu(diaChiQuanLyThanhTuu);
        hluToken = IHoLiHuToken(diaChiHLUToken);
        entryPoint = IEntryPoint(diaChiEntryPoint);
    }

    modifier chiNguoiSoHuuHoacFactory() {
        require(msg.sender == owner() || msg.sender == address(factory), "Chi nguoi so huu hoac factory duoc phep goi");
        _;
    }

    modifier chiProxyTuFactory() {
        require(factory.tonTaiServer(msg.sender), "Chi proxy tu factory moi duoc goi");
        _;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://holihu-metadata.com/";
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorageUpgradeable, AccessControlUpgradeable) returns (bool) {
        return ERC721Upgradeable.supportsInterface(interfaceId) || 
               ERC721URIStorageUpgradeable.supportsInterface(interfaceId) || 
               AccessControlUpgradeable.supportsInterface(interfaceId);
    }

    function capPhieuBau(address cuTri, uint256 idCuocBauCu, uint256 idPhienBauCu, string calldata uriToken) 
        external nonReentrant chiProxyTuFactory {
        require(IQuanLyCuocBauCu(msg.sender).dangHoatDong(idCuocBauCu), "Cuoc bau cu khong hoat dong");
        require(IQuanLyCuocBauCu(msg.sender).laCuTri(idCuocBauCu, idPhienBauCu, cuTri), "Cu tri khong hop le");
        require(!daNhanNFTNay[msg.sender][idPhienBauCu][cuTri], "Cu tri da nhan phieu");

        demSoToken.increment();
        uint256 idTokenMoi = demSoToken.current();

        _mint(cuTri, idTokenMoi);
        _setTokenURI(idTokenMoi, uriToken);
        tokenDenPhienBauCuNay[idTokenMoi] = idPhienBauCu;
        tokenDenCuocBauCuNay[idTokenMoi] = idCuocBauCu;
        daNhanNFTNay[msg.sender][idPhienBauCu][cuTri] = true;
        nguoiSoHuuTokenNay[idTokenMoi] = cuTri;
        
        danhSachTokenCuaPhien[idPhienBauCu].push(idTokenMoi);
        tokenCuaPhien[idPhienBauCu][idTokenMoi] = danhSachTokenCuaPhien[idPhienBauCu].length - 1;

        emit PhieuBauDaCap(cuTri, idTokenMoi, idCuocBauCu, idPhienBauCu, uriToken);
    }

    // Tạo UserOperation để bỏ phiếu
    function taoUserOpBoPhieu(
        address account,
        uint256 idToken,
        uint128 serverId,
        uint256 idPhienBauCu,
        address ungVien
    ) external view returns (IEntryPoint.UserOperation memory) {
        bytes memory callData = abi.encodeWithSelector(
            this.boPhieu.selector,
            idToken,
            serverId,
            idPhienBauCu,
            ungVien
        );
        return IEntryPoint.UserOperation({
            sender: account,
            nonce: entryPoint.getNonce(account),
            initCode: "",
            callData: callData,
            callGasLimit: 100_000,
            verificationGasLimit: 100_000,
            preVerificationGas: 21_000,
            maxFeePerGas: 1 gwei,
            maxPriorityFeePerGas: 1 gwei,
            paymasterAndData: abi.encodePacked(factory.hluPaymaster()), // Dùng HLUPaymaster từ Factory
            signature: "" // Frontend sẽ ký
        });
    }

    function boPhieu(uint256 idToken, uint128 serverId, uint256 idPhienBauCu, address ungVien) 
        external nonReentrant {
        require(_exists(idToken), "Token khong ton tai");
        require(ownerOf(idToken) == msg.sender && nguoiSoHuuTokenNay[idToken] != address(0), "Ban khong so huu NFT nay hoac NFT da duoc su dung");
        require(tokenDenPhienBauCuNay[idToken] == idPhienBauCu, "NFT khong thuoc phien nay");

        (address proxy, , , uint8 trangThai, , ) = factory.layThongTinServer(serverId);
        require(proxy != address(0) && trangThai == 0, "Server khong ton tai hoac khong hoat dong");
        require(tokenDenCuocBauCuNay[idToken] == 1, "NFT khong thuoc cuoc bau cu nay");

        require(!daBoPhieuPhienNay[proxy][1][idPhienBauCu][msg.sender], "Ban da bo phieu trong phien nay");
        require(hluToken.balanceOf(msg.sender) >= PHI_BO_PHIEU, "So du HLU khong du");
        require(hluToken.allowance(msg.sender, address(this)) >= PHI_BO_PHIEU, "Chua approve du HLU");

        require(hluToken.transferFrom(msg.sender, proxy, PHI_BO_PHIEU), "Chuyen HLU that bai");

        nguoiSoHuuTokenNay[idToken] = address(0);
        daBoPhieuPhienNay[proxy][1][idPhienBauCu][msg.sender] = true;
        thoiGianBoPhieuNay[idToken] = block.timestamp;

        IQuanLyCuocBauCu(proxy).ghiNhanPhieuBau(1, idPhienBauCu, ungVien, 1);
        _burn(idToken);

        if (address(quanLyThanhTuu) != address(0)) {
            (,string memory tenCuocBauCu,string memory moTa , , , ) = factory.layThongTinServer(serverId);
            uint256 ngayBatDau = block.timestamp;
            (bool thanhCong, ) = address(quanLyThanhTuu).call(
                abi.encodeWithSignature(
                    "mintAchievement(address,address,uint256,uint256,uint256,string,uint256,string)",
                    proxy,
                    msg.sender,
                    serverId,
                    idPhienBauCu,
                    10,
                    tenCuocBauCu,
                    ngayBatDau,
                    moTa
                )
            );
            require(thanhCong, "Khong the cap thanh tuu");
        }

        emit PhieuDaBo(serverId, idPhienBauCu, msg.sender, idToken, ungVien, block.timestamp);
    }

    function thuHoiNFT(uint256 idToken) external onlyOwner nonReentrant {
        require(_exists(idToken), "Token khong ton tai");
        uint256 idPhienBauCu = tokenDenPhienBauCuNay[idToken];
        uint256 idCuocBauCu = tokenDenCuocBauCuNay[idToken];
        address proxy = chiTietCuocBauCu(uint128(idCuocBauCu));
        require(proxy != address(0), "Cuoc bau cu khong ton tai");
        require(!daBoPhieuPhienNay[proxy][idCuocBauCu][idPhienBauCu][nguoiSoHuuTokenNay[idToken]], "NFT da duoc su dung");
        require(nguoiSoHuuTokenNay[idToken] != address(0), "NFT da duoc su dung");

        address cuTri = ownerOf(idToken);
        _burn(idToken);
        daNhanNFTNay[proxy][idPhienBauCu][cuTri] = false;

        emit NFTDaThuHoi(idToken, msg.sender);
    }

    function thoatPhienVaHuyPhieu(uint256 idToken) external nonReentrant {
        require(_exists(idToken), "Token khong ton tai");
        require(ownerOf(idToken) == msg.sender, "Khong phai chu so huu");
        require(nguoiSoHuuTokenNay[idToken] != address(0), "NFT da duoc su dung");

        uint256 idPhienBauCu = tokenDenPhienBauCuNay[idToken];
        uint256 idCuocBauCu = tokenDenCuocBauCuNay[idToken];
        address server = chiTietCuocBauCu(uint128(idCuocBauCu));
        _burn(idToken);
        daNhanNFTNay[server][idPhienBauCu][msg.sender] = false;

        emit NFTDaThuHoi(idToken, msg.sender);
    }

    function thuHoiNFTKhiPhienKetThuc(uint256, uint256 idPhienBauCu) external chiProxyTuFactory nonReentrant {
        uint256[] storage tokens = danhSachTokenCuaPhien[idPhienBauCu];
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 idToken = tokens[i];
            if (_exists(idToken) && nguoiSoHuuTokenNay[idToken] != address(0)) {
                address cuTri = ownerOf(idToken);
                _burn(idToken);
                daNhanNFTNay[msg.sender][idPhienBauCu][cuTri] = false;
                emit NFTDaThuHoi(idToken, msg.sender);
            }
        }
        delete danhSachTokenCuaPhien[idPhienBauCu];
    }

    function _beforeTokenTransfer(address tu, address den, uint256 idToken, uint256 soLuong) internal override {
        require(tu == address(0) || den == address(0), "NFT khong the chuyen nhuong");
        require(soLuong == 1, "Khong ho tro chuyen nhieu token");
        super._beforeTokenTransfer(tu, den, idToken, soLuong);
    }

    struct TrangThaiQuyenBauCu {
        bool tonTai;
        bool daBoPhieu;
        bool laNguoiSoHuu;
        bool phienHopLe;
        bool trongThoiGian;
    }

    function daBoPhieu(uint128 serverId, uint256 idPhienBauCu, address cuTri) external view returns (bool) {
        (address proxy, , , uint8 trangThai, , ) = factory.layThongTinServer(serverId);
        return proxy != address(0) && trangThai == 0 ? daBoPhieuPhienNay[proxy][1][idPhienBauCu][cuTri] : false;
    }

    function kiemTraQuyenBauCu(address cuTri, uint128 serverId, uint256 idPhienBauCu, uint256 idToken) 
        external view returns (bool) {
        (address proxy, , , uint8 trangThai, , ) = factory.layThongTinServer(serverId);
        if (proxy == address(0) || trangThai != 0 || !_exists(idToken) || daBoPhieuPhienNay[proxy][1][idPhienBauCu][cuTri]) return false;
        return (
            ownerOf(idToken) == cuTri &&
            nguoiSoHuuTokenNay[idToken] != address(0) &&
            tokenDenPhienBauCuNay[idToken] == idPhienBauCu &&
            tokenDenCuocBauCuNay[idToken] == 1 &&
            IQuanLyCuocBauCu(proxy).dangHoatDong(1)
        );
    }

    function kiemTraQuyenBauCuChiTiet(address cuTri, uint128 serverId, uint256 idPhienBauCu, uint256 idToken) 
        external view returns (TrangThaiQuyenBauCu memory) {
        (address proxy, , , uint8 trangThai, , ) = factory.layThongTinServer(serverId);
        bool dangHoatDong = proxy != address(0) && trangThai == 0 ? IQuanLyCuocBauCu(proxy).dangHoatDong(1) : false;

        return TrangThaiQuyenBauCu(
            _exists(idToken),
            daBoPhieuPhienNay[proxy][1][idPhienBauCu][cuTri],
            ownerOf(idToken) == cuTri && nguoiSoHuuTokenNay[idToken] != address(0),
            tokenDenPhienBauCuNay[idToken] == idPhienBauCu && tokenDenCuocBauCuNay[idToken] == 1,
            dangHoatDong
        );
    }

    // Sửa đổi: Thêm hàm mới cho phép chủ sở hữu cuộc bầu cử cấp phiếu bầu
    // Thêm vào sau hàm capPhieuBau

    function capPhieuBauChuSoHuu(address cuTri, uint256 idCuocBauCu, uint256 idPhienBauCu, string calldata uriToken) 
        external nonReentrant {
        // Lấy proxy/server từ ID cuộc bầu cử
        (address proxy, , , uint8 trangThai, , ) = factory.layThongTinServer(uint128(idCuocBauCu));
        require(proxy != address(0) && trangThai == 0, "Server khong ton tai hoac khong hoat dong");
        
        // Lấy thông tin chủ sở hữu cuộc bầu cử - Đã sửa cú pháp
        address chuSoHuu;
        try IQuanLyCuocBauCu(proxy).layThongTinCoBan(idCuocBauCu) returns (
            address _chuSoHuu,
            bool _dangHoatDong,
            uint256 _thoiGianBatDau,
            uint256 _thoiGianKetThuc,
            string memory _tenCuocBauCu,
            uint256 _phiHLU
        ) {
            chuSoHuu = _chuSoHuu;
            // Kiểm tra người gọi là chủ sở hữu cuộc bầu cử
            require(msg.sender == chuSoHuu, "Chi chu so huu cuoc bau cu moi duoc phep goi");
        } catch {
            revert("Khong the lay thong tin chu so huu");
        }
        
        // Kiểm tra các điều kiện khác
        require(IQuanLyCuocBauCu(proxy).dangHoatDong(idCuocBauCu), "Cuoc bau cu khong hoat dong");
        require(IQuanLyCuocBauCu(proxy).laCuTri(idCuocBauCu, idPhienBauCu, cuTri), "Cu tri khong hop le");
        require(!daNhanNFTNay[proxy][idPhienBauCu][cuTri], "Cu tri da nhan phieu");
        
        // Cấp phiếu bầu 
        demSoToken.increment();
        uint256 idTokenMoi = demSoToken.current();
        
        _mint(cuTri, idTokenMoi);
        _setTokenURI(idTokenMoi, uriToken);
        tokenDenPhienBauCuNay[idTokenMoi] = idPhienBauCu;
        tokenDenCuocBauCuNay[idTokenMoi] = idCuocBauCu;
        daNhanNFTNay[proxy][idPhienBauCu][cuTri] = true;
        nguoiSoHuuTokenNay[idTokenMoi] = cuTri;
        
        danhSachTokenCuaPhien[idPhienBauCu].push(idTokenMoi);
        tokenCuaPhien[idPhienBauCu][idTokenMoi] = danhSachTokenCuaPhien[idPhienBauCu].length - 1;
        
        emit PhieuBauDaCap(cuTri, idTokenMoi, idCuocBauCu, idPhienBauCu, uriToken);
    }

    function tokenDenPhienBauCu(uint256 idToken) external view returns (uint256) {
        return tokenDenPhienBauCuNay[idToken];
    }

    function tokenDenCuocBauCu(uint256 idToken) external view returns (uint256) {
        return tokenDenCuocBauCuNay[idToken];
    }

    function nguoiSoHuuToken(uint256 idToken) external view returns (address) {
        return nguoiSoHuuTokenNay[idToken];
    }

    function daNhanNFT(address server, uint256 idPhienBauCu, address cuTri) external view returns (bool) {
        return daNhanNFTNay[server][idPhienBauCu][cuTri];
    }

    function thoiGianBoPhieu(uint256 idToken) external view returns (uint256) {
        return thoiGianBoPhieuNay[idToken];
    }

    function totalSupply() external view returns (uint256) {
        return demSoToken.current();
    }

    function layDanhSachTokenCuaPhien(uint256 idPhienBauCu) external view returns (uint256[] memory) {
        return danhSachTokenCuaPhien[idPhienBauCu];
    }

    function chiTietCuocBauCu(uint128 serverId) internal view returns (address) {
        (address quanLyCuocBauCuAddress, , , uint8 trangThai, , ) = factory.layThongTinServer(serverId);
        return trangThai == 0 ? quanLyCuocBauCuAddress : address(0);
    }
}