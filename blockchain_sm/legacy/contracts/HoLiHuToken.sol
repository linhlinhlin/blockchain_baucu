// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol"; // Đường dẫn đã thay đổi
import "@openzeppelin/contracts/utils/math/Math.sol";
contract HoLiHuToken is ERC20Burnable, ERC20Pausable, ERC20Permit, AccessControlEnumerable {
    using Math for uint256;

    uint256 public constant NGUON_CUNG_BAN_DAU = 1_000_000 * 10**18; // 1 triệu HLU ban đầu
    uint256 public constant NGUON_CUNG_TOI_DA = 2_222_512 * 10**18;  // Tổng cung tối đa 2.222.512 HLU
    uint256 public constant PHAN_TRAM_PHI_TOI_DA = 5;                // Phí tối đa 5%
    uint256 public constant MINT_TOI_DA_MOT_LAN = 102_004 * 10**18;  // 100k HLU mỗi lần

    bytes32 public constant VAI_TRO_MINTER = keccak256("VAI_TRO_MINTER");
    bytes32 public constant VAI_TRO_PAUSER = keccak256("VAI_TRO_PAUSER");
    bytes32 public constant VAI_TRO_QUAN_LY_PHI = keccak256("VAI_TRO_QUAN_LY_PHI");

    uint256 public phanTramPhiChuyen;
    address public diaChiNhanPhi;
    mapping(address => uint256) public giamPhi;
    mapping(address => bool) public danhDauDeDotToken;
    mapping(address => uint256) private soLuotXacNhanDot;
    mapping(address => mapping(address => bool)) private xacNhanDot;

    event PhiDaThu(address indexed nguoiGui, address indexed nguoiNhan, uint256 phi);
    event GiamPhiDaDat(address indexed taiKhoan, uint256 mucGiam);
    event CapNhatPhiChuyen(uint256 phiMoi);
    event CapNhatDiaChiNhanPhi(address indexed diaChiMoi);
    event ChuyenVaiTroAdmin(address indexed adminCu, address indexed adminMoi);
    event TaiKhoanBiDanhDauDeDot(address indexed taiKhoan, bool trangThai);

    constructor(address admin, address _diaChiNhanPhi) 
        ERC20("HoLiHu Token", "HLU")
        ERC20Permit("HoLiHu Token")
    {
        require(admin != address(0), "Dia chi admin khong duoc la zero");
        require(_diaChiNhanPhi != address(0), "Dia chi nhan phi khong duoc la zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VAI_TRO_MINTER, admin);
        _grantRole(VAI_TRO_PAUSER, admin);
        _grantRole(VAI_TRO_QUAN_LY_PHI, admin);

        diaChiNhanPhi = _diaChiNhanPhi;
        phanTramPhiChuyen = 5;
        _mint(admin, NGUON_CUNG_BAN_DAU);
    }

    function mint(address nguoiNhan, uint256 soLuong) external onlyRole(VAI_TRO_MINTER) {
        require(soLuong <= MINT_TOI_DA_MOT_LAN, "Vuot qua gioi han mint mot lan");
        require(totalSupply() + soLuong <= NGUON_CUNG_TOI_DA, "Vuot qua nguon cung toi da");
        _mint(nguoiNhan, soLuong);
    }

    function dotTuTaiKhoan(address taiKhoan, uint256 soLuong) public {
        if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            require(danhDauDeDotToken[taiKhoan], "Tai khoan khong bi danh dau de dot");
            _burn(taiKhoan, soLuong);
        } else {
            super.burnFrom(taiKhoan, soLuong);
        }
    }

    function danhDauDeDot(address taiKhoan, bool trangThai) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(taiKhoan != address(0), "Tai khoan khong hop le");

        if (trangThai) {
            require(!xacNhanDot[taiKhoan][msg.sender], "Da xac nhan truoc do");
            xacNhanDot[taiKhoan][msg.sender] = true;
            soLuotXacNhanDot[taiKhoan]++;
        } else {
            require(xacNhanDot[taiKhoan][msg.sender], "Chua xac nhan truoc do");
            xacNhanDot[taiKhoan][msg.sender] = false;
            soLuotXacNhanDot[taiKhoan]--;
        }

        bool trangThaiMoi = soLuotXacNhanDot[taiKhoan] >= 2;
        if (danhDauDeDotToken[taiKhoan] != trangThaiMoi) {
            danhDauDeDotToken[taiKhoan] = trangThaiMoi;
            emit TaiKhoanBiDanhDauDeDot(taiKhoan, trangThaiMoi);
        }
    }

    function tamDung() external onlyRole(VAI_TRO_PAUSER) {
        _pause();
    }

    function batLai() external onlyRole(VAI_TRO_PAUSER) {
        _unpause();
    }

    function capNhatPhiChuyen(uint256 phiMoi) external onlyRole(VAI_TRO_QUAN_LY_PHI) {
        require(phiMoi <= PHAN_TRAM_PHI_TOI_DA, "Phi qua cao");
        phanTramPhiChuyen = phiMoi;
        emit CapNhatPhiChuyen(phiMoi);
    }

    function capNhatDiaChiNhanPhi(address diaChiMoi) external onlyRole(VAI_TRO_QUAN_LY_PHI) {
        require(diaChiMoi != address(0), "Dia chi khong hop le");
        require(diaChiMoi != diaChiNhanPhi, "Dia chi trung lap");
        diaChiNhanPhi = diaChiMoi;
        emit CapNhatDiaChiNhanPhi(diaChiMoi);
    }

    function datGiamPhi(address taiKhoan, uint256 mucGiam) external onlyRole(VAI_TRO_QUAN_LY_PHI) {
        require(mucGiam <= 100, "Muc giam qua cao");
        giamPhi[taiKhoan] = mucGiam;
        emit GiamPhiDaDat(taiKhoan, mucGiam);
    }

    function tuBoVaiTroAdmin() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) > 1, "Phai co it nhat mot admin");
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function chuyenVaiTroAdmin(address adminMoi) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(adminMoi != address(0), "Admin moi khong duoc la zero");
        address adminCu = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, adminMoi);
        _revokeRole(DEFAULT_ADMIN_ROLE, adminCu);
        emit ChuyenVaiTroAdmin(adminCu, adminMoi);
    }

    function chuyenVoiPermit(
        address chuSoHuu,
        address nguoiNhan,
        uint256 giaTri,
        uint256 hanChot,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        permit(chuSoHuu, msg.sender, giaTri, hanChot, v, r, s);
        transferFrom(chuSoHuu, nguoiNhan, giaTri);
    }

    function totalSupply() public view override returns (uint256) {
        return super.totalSupply();
    }

    function tinhPhiHieuQua(address nguoiGui, address nguoiNhan) internal view returns (uint256) {
        uint256 giamPhiNguoiGui = giamPhi[nguoiGui];
        uint256 giamPhiNguoiNhan = giamPhi[nguoiNhan];
        uint256 mucGiamCaoNhat = giamPhiNguoiGui > giamPhiNguoiNhan ? giamPhiNguoiGui : giamPhiNguoiNhan;
        return phanTramPhiChuyen.mulDiv(100 - mucGiamCaoNhat, 100, Math.Rounding.Down);
    }

    function _transfer(address nguoiGui, address nguoiNhan, uint256 soLuong) internal override {
        require(!paused(), "Giao dich bi tam dung");

        uint256 phanTramPhiHieuQua = tinhPhiHieuQua(nguoiGui, nguoiNhan);
        uint256 phi = soLuong.mulDiv(phanTramPhiHieuQua, 100, Math.Rounding.Down);
        
        uint256 soLuongSauPhi = soLuong - phi;

        if (phi > 0) {
            super._transfer(nguoiGui, diaChiNhanPhi, phi);
            emit PhiDaThu(nguoiGui, nguoiNhan, phi);
        }
        super._transfer(nguoiGui, nguoiNhan, soLuongSauPhi);
    }

    function _mint(address account, uint256 amount) internal override {
        require(totalSupply() + amount <= NGUON_CUNG_TOI_DA, "Vuot qua nguon cung toi da");
        super._mint(account, amount);
    }

    function _beforeTokenTransfer(address nguoiGui, address nguoiNhan, uint256 soLuong) 
        internal override(ERC20, ERC20Pausable) 
    {
        super._beforeTokenTransfer(nguoiGui, nguoiNhan, soLuong);
        require(!paused() || hasRole(VAI_TRO_MINTER, nguoiGui), "Giao dich bi tam dung");
    }
}