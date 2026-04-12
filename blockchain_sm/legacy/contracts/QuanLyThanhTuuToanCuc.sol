// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IQuanLyPhieuBauToanCuc.sol";
import "hardhat/console.sol";

contract QuanLyThanhTuuToanCuc is Initializable, ERC721URIStorageUpgradeable, OwnableUpgradeable, AccessControlUpgradeable {
    using Counters for Counters.Counter;
    Counters.Counter private demSoThanhTuu;

    bytes32 public constant QUANTRI_HE_THONG = keccak256("QUANTRI_HE_THONG");

    IQuanLyPhieuBauToanCuc public quanLyPhieuBau;
    address public factory;

    enum CapBacThanhTuu { Dong, Bac, Vang, KimCuong }

    struct ThongTinThanhTuu {
        CapBacThanhTuu capBac;
        uint256 idCuocBauCu; // Thực tế là serverId
        uint256 idPhienBauCu;
        uint256 thoiGian;
        string tenCuocBauCu;
        uint256 ngayBatDau;
        string moTa;
    }

    mapping(address => mapping(address => mapping(uint256 => bool))) public daNhanThanhTuuNay;
    mapping(address => uint256) public soLanThamGiaPhien;
    mapping(address => uint256[]) public danhSachThanhTuuNguoiDung;
    mapping(uint256 => ThongTinThanhTuu) public tokenDenThanhTuu;
    mapping(CapBacThanhTuu => string) private uriToken;

    event ThanhTuuDaCap(address indexed cuTri, uint256 idToken, CapBacThanhTuu capBac, uint256 idCuocBauCu, uint256 idPhienBauCu, string uriToken);
    event QuanLyPhieuBauDaCapNhat(address indexed diaChiCu, address indexed diaChiMoi);

    function initialize(address diaChiQuanLyPhieuBau, address nguoiKhoiTao) 
        external initializer {
        require(diaChiQuanLyPhieuBau != address(0), "Dia chi QuanLyPhieuBau khong hop le");

        __ERC721_init("HoLiHu Thanh Tuu", "HLU-TT");
        __ERC721URIStorage_init();
        __Ownable_init();
        __AccessControl_init();

        _transferOwnership(nguoiKhoiTao);
        _grantRole(QUANTRI_HE_THONG, nguoiKhoiTao);
        _grantRole(QUANTRI_HE_THONG, msg.sender);

        quanLyPhieuBau = IQuanLyPhieuBauToanCuc(diaChiQuanLyPhieuBau);
        factory = msg.sender;

        uriToken[CapBacThanhTuu.Dong] = "ipfs://Qm.../dong.json";
        uriToken[CapBacThanhTuu.Bac] = "ipfs://Qm.../bac.json";
        uriToken[CapBacThanhTuu.Vang] = "ipfs://Qm.../vang.json";
        uriToken[CapBacThanhTuu.KimCuong] = "ipfs://Qm.../kimcuong.json";
    }

    modifier chiNguoiSoHuuHoacFactory() {
        require(msg.sender == owner() || msg.sender == factory, "Chi nguoi so huu hoac factory duoc phep goi");
        _;
    }

    modifier chiQuanLyPhieuBau() {
        require(msg.sender == address(quanLyPhieuBau), "Chi QuanLyPhieuBau duoc phep goi");
        _;
    }

    function mintAchievement(
        address proxy, 
        address cuTri, 
        uint256 serverId, // Thay idCuocBauCu bằng serverId
        uint256 idPhienBauCu, 
        uint256 diemThuong,
        string memory tenCuocBauCu,
        uint256 ngayBatDau,
        string memory moTa
    ) external chiQuanLyPhieuBau {
        require(proxy != address(0), "Proxy khong hop le");
        require(!daNhanThanhTuuNay[proxy][cuTri][idPhienBauCu], "Cu tri da nhan thanh tuu tu phien nay trong server nay");

        soLanThamGiaPhien[cuTri]++;
        daNhanThanhTuuNay[proxy][cuTri][idPhienBauCu] = true;

        CapBacThanhTuu capBac = layCapBacThanhTuu(soLanThamGiaPhien[cuTri], diemThuong);
        string memory uriTokenCap = layUriToken(capBac);

        demSoThanhTuu.increment();
        uint256 idTokenMoi = demSoThanhTuu.current();

        _mint(cuTri, idTokenMoi);
        _setTokenURI(idTokenMoi, uriTokenCap);
        danhSachThanhTuuNguoiDung[cuTri].push(idTokenMoi);
        tokenDenThanhTuu[idTokenMoi] = ThongTinThanhTuu(
            capBac, 
            serverId, // Lưu serverId vào idCuocBauCu
            idPhienBauCu, 
            block.timestamp,
            tenCuocBauCu,
            ngayBatDau,
            moTa
        );

        emit ThanhTuuDaCap(cuTri, idTokenMoi, capBac, serverId, idPhienBauCu, uriTokenCap);
    }

    function layCapBacThanhTuu(uint256 soLan, uint256 diemThuong) internal pure returns (CapBacThanhTuu) {
        uint256 tongDiem = soLan * 10 + diemThuong;
        if (tongDiem >= 200) return CapBacThanhTuu.KimCuong;
        if (tongDiem >= 100) return CapBacThanhTuu.Vang;
        if (tongDiem >= 50) return CapBacThanhTuu.Bac;
        return CapBacThanhTuu.Dong;
    }

    function layUriToken(CapBacThanhTuu capBac) internal view returns (string memory) {
        return uriToken[capBac];
    }

    function setUriToken(CapBacThanhTuu capBac, string calldata newUri) external onlyOwner {
        uriToken[capBac] = newUri;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://holihu-metadata.com/achievements/";
    }

    function soLanThamGia(address cuTri) external view returns (uint256) {
        return soLanThamGiaPhien[cuTri];
    }

    function daNhanThanhTuu(address proxy, address cuTri, uint256 idPhienBauCu) external view returns (bool) {
        return daNhanThanhTuuNay[proxy][cuTri][idPhienBauCu];
    }

    function layDanhSachThanhTuu(address cuTri) external view returns (uint256[] memory) {
        return danhSachThanhTuuNguoiDung[cuTri];
    }

    function layThanhTuuTheoChiSo(address cuTri, uint256 chiSo) external view returns (uint256) {
        require(chiSo < danhSachThanhTuuNguoiDung[cuTri].length, "Chi so vuot qua gioi han");
        return danhSachThanhTuuNguoiDung[cuTri][chiSo];
    }

    function layThongTinThanhTuu(uint256 idToken) external view returns (ThongTinThanhTuu memory) {
        require(_exists(idToken), "Thanh tuu khong ton tai");
        return tokenDenThanhTuu[idToken];
    }

    function totalSupply() external view returns (uint256) {
        return demSoThanhTuu.current();
    }

    function _beforeTokenTransfer(address tu, address den, uint256 idToken, uint256 soLuong) 
        internal override {
        require(tu == address(0) || den == address(0), "NFT thanh tuu khong the chuyen nhuong");
        require(soLuong == 1, "Khong ho tro chuyen nhieu token");
        super._beforeTokenTransfer(tu, den, idToken, soLuong);
    }

    function thietLapQuanLyPhieuBau(address diaChiQuanLyPhieuBau) external chiNguoiSoHuuHoacFactory {
        require(diaChiQuanLyPhieuBau != address(0) && diaChiQuanLyPhieuBau.code.length > 0, "Dia chi khong hop le");
        address diaChiCu = address(quanLyPhieuBau);
        quanLyPhieuBau = IQuanLyPhieuBauToanCuc(diaChiQuanLyPhieuBau);
        emit QuanLyPhieuBauDaCapNhat(diaChiCu, diaChiQuanLyPhieuBau);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorageUpgradeable, AccessControlUpgradeable) returns (bool) {
        return ERC721Upgradeable.supportsInterface(interfaceId) || 
               ERC721URIStorageUpgradeable.supportsInterface(interfaceId) || 
               AccessControlUpgradeable.supportsInterface(interfaceId);
    }
}