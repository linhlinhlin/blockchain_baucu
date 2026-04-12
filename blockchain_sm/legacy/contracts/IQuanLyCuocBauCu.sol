// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IEntryPoint.sol";

interface IQuanLyCuocBauCu {
    function initialize(
        address nguoiTao,
        address _quanLyPhieuBau,
        address _quanLyThanhTuuToanCuc,
        address _hluToken,
        address _entryPoint,
        string memory tenCuocBauCu,
        uint256 thoiGianKeoDai
    ) external;

    // Các hàm tạo UserOperation cho EIP-4337
    function taoUserOpTaoPhienBauCu(
        address account,
        uint256 idCuocBauCu,
        uint256 thoiGianKeoDai,
        uint256 soCuTriToiDa
    ) external view returns (IEntryPoint.UserOperation memory);

    function taoUserOpThemUngVien(
        address account,
        uint256 idCuocBauCu,
        uint256 idPhienBauCu,
        address ungVien
    ) external view returns (IEntryPoint.UserOperation memory);

    function taoUserOpCapPhieuBauChoCuTri(
        address account,
        uint256 idCuocBauCu,
        uint256 idPhienBauCu,
        address cuTri,
        string calldata tokenURI
    ) external view returns (IEntryPoint.UserOperation memory);

    function taoUserOpYeuCauTaiBauCu(
        address account,
        uint256 idCuocBauCu,
        uint256 idPhienBauCu
    ) external view returns (IEntryPoint.UserOperation memory);

    // Các hàm hiện có
    function dangHoatDong(uint256 idCuocBauCu) external view returns (bool);
    function tonTai(uint256 idCuocBauCu) external view returns (bool);
    function layThongTinCuocBauCu(uint256 idCuocBauCu)
        external view returns (address nguoiSoHuu, bool isDangHoatDong, uint256 thoiGianBatDau, uint256 thoiGianKetThuc);
    function layDanhSachPhienBauCu(uint256 idCuocBauCu, uint256 chiSoBatDau, uint256 gioiHan)
        external view returns (uint256[] memory);
    function coPhienBauCuDangHoatDong() external view returns (bool);
    function batDauCuocBauCu(uint256 idCuocBauCu, uint256 thoiGianKeoDai) external;
    function ketThucCuocBauCu(uint256 idCuocBauCu) external;
    function huyCuocBauCu(uint256 idCuocBauCu, string calldata lyDo) external;
    function xoaCuocBauCu(uint256 idCuocBauCu) external;
    function taoPhienBauCu(uint256 idCuocBauCu, uint256 thoiGianKeoDai, uint256 soCuTriToiDa) external returns (uint256);
    function batDauPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu, uint256 thoiGianKeoDai) external;
    function ketThucPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) external;
    function tuDongKetThucPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) external;
    function huyPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu, string calldata lyDo) external;
    function themUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu, address ungVien) external;
    function capPhieuBauChoCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address cuTri, string calldata tokenURI) external;
    function ghiNhanPhieuBau(uint256 idCuocBauCu, uint256 idPhienBauCu, address ungVien, uint256 soPhieu) external;
    function chuyenQuyenQuanTriCuocBauCu(uint256 idCuocBauCu, address nguoiSoHuuMoi) external;
    function themBanToChuc(address banToChuc) external;
    function xoaBanToChuc(address banToChuc) external;
    function soLuongCuocBauCuTonTai() external view returns (uint256);
    function layDanhSachIdTonTai() external view returns (uint256[] memory);
    function layDanhSachUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu) external view returns (address[] memory);
    function laCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address cuTri) external view returns (bool);
    function laySoPhieuUngVien(uint256 idCuocBauCu, uint256 idPhienBauCu, address ungVien) external view returns (uint256);
    function laPhienHoatDong(uint256 idCuocBauCu, uint256 idPhienBauCu) external view returns (bool);
    function themCuTri(uint256 idCuocBauCu, uint256 idPhienBauCu, address cuTri) external;

    // Các hàm liên quan đến tái bầu cử
    function yeuCauTaiBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) external returns (uint256);
    function xacNhanTaiBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) external;
    function layDanhSachUngVienDacCu(uint256 idCuocBauCu, uint256 idPhienBauCu) external view returns (address[] memory);

    // Các hàm thông tin cơ bản và phiên bầu cử
    function layThongTinCoBan(uint256 idCuocBauCu) external view returns (
        address nguoiSoHuu,
        bool dangHoatDongDay,
        uint256 thoiGianBatDau,
        uint256 thoiGianKetThuc,
        string memory tenCuocBauCu,
        uint256 phiHLU
    );

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
        );

    function thuHoiNFTKhiPhienKetThuc(uint256 idCuocBauCu, uint256 idPhienBauCu) external;

    // Các hàm mới để tăng tính minh bạch và kiểm tra thời gian
    function layKetQuaPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
        external view returns (address[] memory ungVien, uint256[] memory soPhieu);

    function canKetThucPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
        external view returns (bool);
        // Các hàm mới để hỗ trợ kết thúc sớm phiên bầu cử
function canKetThucSomPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
    external view returns (bool);

function ketThucSomPhienBauCu(uint256 idCuocBauCu, uint256 idPhienBauCu)
    external;

function tatCaCuTriDaBoPhieu(uint256 idCuocBauCu, uint256 idPhienBauCu) 
    external view returns (bool);

function ketThucPhienKhiBoPhieuDayDu(uint256 idCuocBauCu, uint256 idPhienBauCu)
    external;

function thietLapNguongKetThucSom(uint256 idCuocBauCu, uint256 idPhienBauCu, uint256 nguongMoi)
    external;
}