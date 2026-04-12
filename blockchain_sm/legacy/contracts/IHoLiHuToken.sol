// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IHoLiHuToken {
    // Các hàm cơ bản của ERC20 cần thiết cho hệ thống
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    // Các hàm burn (từ ERC20Burnable)
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;

    // Hàm đặc thù từ HoLiHuToken.sol cần cho quản lý
    function mint(address recipient, uint256 amount) external;
    function dotTuTaiKhoan(address taiKhoan, uint256 soLuong) external;

    // Hàm quản lý paused (từ ERC20Pausable)
    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);

    // Hàm liên quan đến phí giao dịch
    function capNhatPhiChuyen(uint256 phiMoi) external;
    function capNhatDiaChiNhanPhi(address diaChiMoi) external;
    function datGiamPhi(address taiKhoan, uint256 mucGiam) external;
    function phanTramPhiChuyen() external view returns (uint256);
    function diaChiNhanPhi() external view returns (address);
    function giamPhi(address account) external view returns (uint256);

    // Hàm permit (từ ERC20Permit)
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    // Hàm quản lý vai trò (từ AccessControl)
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
    function getRoleMemberCount(bytes32 role) external view returns (uint256);

    // Constants
    function NGUON_CUNG_BAN_DAU() external view returns (uint256);
    function NGUON_CUNG_TOI_DA() external view returns (uint256);
    function PHAN_TRAM_PHI_TOI_DA() external view returns (uint256);
    function MINT_TOI_DA_MOT_LAN() external view returns (uint256);
    function VAI_TRO_MINTER() external view returns (bytes32);
    function VAI_TRO_PAUSER() external view returns (bytes32);
    function VAI_TRO_QUAN_LY_PHI() external view returns (bytes32);
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);

    // Events (đồng bộ với contract)
    event PhiDaThu(address indexed nguoiGui, address indexed nguoiNhan, uint256 phi);
    event GiamPhiDaDat(address indexed taiKhoan, uint256 mucGiam);
    event CapNhatPhiChuyen(uint256 phiMoi);
    event CapNhatDiaChiNhanPhi(address indexed diaChiMoi);
    event ChuyenVaiTroAdmin(address indexed adminCu, address indexed adminMoi);
    event TaiKhoanBiDanhDauDeDot(address indexed taiKhoan, bool trangThai);
}