// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IEntryPoint.sol";
import "./IHoLiHuToken.sol";

interface ICuocBauCuFactory {
    // Events (thêm để đồng bộ với contract thực tế)
    event ServerDaTao(uint128 indexed id, address indexed proxyQuanLyCuocBauCu, address indexed nguoiTao, string tenCuocBauCu);
    event SimpleAccountDaTao(address indexed account, address indexed owner);

    // Các hàm hiện có từ contract gốc
    function tonTaiServer(address server) external view returns (bool);
    function trienKhaiServer(string memory tenCuocBauCu, uint256 thoiGianKeoDai, string memory moTa) external returns (uint128); // Đổi sang uint128 như contract
    function layThongTinServer(uint128 id) external view returns (
        address quanLyCuocBauCu,
        string memory tenCuocBauCu,
        string memory moTa,
        uint8 trangThai,
        uint256 soLuongBaoCao,
        uint256 soLuongViPhamXacNhan
    );
    
    // Các getter cho các biến public/state
    function hluPaymaster() external view returns (address);
    function hluToken() external view returns (IHoLiHuToken);
    function entryPoint() external view returns (IEntryPoint);
    function simpleAccountImplementation() external view returns (address);
    function mauQuanLyCuocBauCu() external view returns (address);
    function quanLyPhieuBauToanCuc() external view returns (address);
    function quanLyThanhTuuToanCuc() external view returns (address);
    function proxyAdmin() external view returns (address); // Thay getProxyAdmin()

    // Hàm liên quan đến EIP-4337
    function taoSimpleAccount(bytes32 salt, address accountOwner, bytes calldata signature) external returns (address); // Cập nhật tham số đầy đủ
    function taoUserOpSimpleAccount(bytes32 salt, address accountOwner) external view returns (IEntryPoint.UserOperation memory); // Thêm hàm đã có trong contract

    // Hàm tạo UserOperation cho triển khai server (nếu cần trong tương lai)
    function taoUserOpTrienKhaiServer(
        address account,
        string memory tenCuocBauCu,
        uint256 thoiGianKeoDai,
        string memory moTa
    ) external view returns (IEntryPoint.UserOperation memory);
    
    // Các hàm quản lý
    function tamDungCuocBauCu(uint128 id, string memory lyDo) external; // Đổi sang uint128
    function khoiPhucCuocBauCu(uint128 id) external; // Đổi sang uint128
    function guiBaoCaoViPham(uint128 idServer, string memory lyDo) external; // Đổi sang uint128
    function xuLyBaoCao(uint128 idServer, uint256 idBaoCao, bool ketQua, string memory lyDoTuChoi) external; // Đổi sang uint128
    function luuTruCuocBauCu(uint128 id, bytes32) external; // Đổi sang uint128
    
    // Hàm xem thông tin
    function layDanhSachServerDangHoatDong() external view returns (uint128[] memory); // Đổi sang uint128
    function layDanhSachServerDaLuuTru() external view returns (uint128[] memory); // Đổi sang uint128
    function layServerCuaNguoiDung(address nguoiDung) external view returns (uint128[] memory); // Đổi sang uint128
    
    // Tìm kiếm
    function timServerTheoTenHoacMoTa(string memory tenHoacMoTa) external view returns (uint128[] memory); // Đổi sang uint128
    function timServerLuuTruTheoTenHoacMoTa(string memory tenHoacMoTa) external view returns (uint128[] memory); // Đổi sang uint128
    
    // Quản lý vai trò
    function kiemTraVaiTro(address account) external view returns (bytes32[] memory);
    function grantTrustSafetyRole(bytes32 role, address account) external;
    function revokeTrustSafetyRole(bytes32 role, address account) external;
    
    // Constants
    function QUANTRI_HE_THONG() external view returns (bytes32);
    function QUANTRI_SERVER() external view returns (bytes32);
    function DIEU_TRA_VIEN() external view returns (bytes32);
    function KIEMDUYET_VIEN() external view returns (bytes32);

    // Hàm kiểm tra trạng thái paused (từ OpenZeppelin Pausable)
    function paused() external view returns (bool);
}