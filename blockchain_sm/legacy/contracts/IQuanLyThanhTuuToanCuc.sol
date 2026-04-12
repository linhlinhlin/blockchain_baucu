// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IQuanLyThanhTuu {
    enum CapBacThanhTuu { Dong, Bac, Vang, KimCuong }

    struct ThongTinThanhTuu {
        CapBacThanhTuu capBac;
        uint256 idCuocBauCu;
        uint256 idPhienBauCu;
        uint256 thoiGian;
    }

    // --- Quản Lý Thành Tựu ---
    function mintAchievement(address proxy, address cuTri, uint256 idCuocBauCu, uint256 idPhienBauCu, uint256 diemThuong) external;
    function daNhanThanhTuu(address proxy, address cuTri, uint256 idPhienBauCu) external view returns (bool);
    function requestHLUReward(address cuTri, uint256 amount) external; // Thêm hàm yêu cầu HLU

    // --- Setter ---
    function thietLapQuanLyPhieuBau(address diaChiQuanLyPhieuBau) external;
    function thietLapQuanLyCuocBauCu(address diaChiQuanLyCuocBauCu) external;

    // --- Getter ---
    function soLanThamGia(address cuTri) external view returns (uint256);
    function layDanhSachThanhTuu(address cuTri) external view returns (uint256[] memory);
    function layThanhTuuTheoChiSo(address cuTri, uint256 chiSo) external view returns (uint256);
    function layThongTinThanhTuu(uint256 idToken) external view returns (ThongTinThanhTuu memory);
    function totalSupply() external view returns (uint256);
}