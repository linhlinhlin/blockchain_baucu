// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IQuanLyPhieuBauToanCuc {
    // --- Quản Lý Phiếu Bầu ---
    function capPhieuBau(address cuTri, uint256 idCuocBauCu, uint256 idPhienBauCu, string calldata uriToken) external;
    function boPhieu(uint256 idToken, uint256 serverId, uint256 idPhienBauCu, address ungVien) external;
    function thuHoiNFT(uint256 idToken) external;
    function thuHoiNFTKhiPhienKetThuc(uint256 idCuocBauCu, uint256 idPhienBauCu) external;

    // --- Getter ---
    function daBoPhieu(uint256 serverId, uint256 idPhienBauCu, address cuTri) external view returns (bool);
    function kiemTraQuyenBauCu(address cuTri, uint256 serverId, uint256 idPhienBauCu, uint256 idToken) external view returns (bool);
    
    struct TrangThaiQuyenBauCu {
        bool tonTai;
        bool daBoPhieu;
        bool laNguoiSoHuu;
        bool phienHopLe;
        bool trongThoiGian;
    }
    function kiemTraQuyenBauCuChiTiet(address cuTri, uint256 serverId, uint256 idPhienBauCu, uint256 idToken) 
        external view returns (TrangThaiQuyenBauCu memory);

    function tokenDenPhienBauCu(uint256 idToken) external view returns (uint256);
    function tokenDenCuocBauCu(uint256 idToken) external view returns (uint256);
    function nguoiSoHuuToken(uint256 idToken) external view returns (address);
    function daNhanNFT(address server, uint256 idPhienBauCu, address cuTri) external view returns (bool);
    function thoiGianBoPhieu(uint256 idToken) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}