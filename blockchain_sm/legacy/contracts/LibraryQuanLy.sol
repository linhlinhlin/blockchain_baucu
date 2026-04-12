// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library LibraryQuanLy {
    struct QuanLyMapping {
        mapping(address => address) cuocBauCuDenPhieuBau; // QuanLyCuocBauCu -> QuanLyPhieuBau
        // Xóa phieuBauDenThanhTuu và phieuBauDenCuocBauCu
    }

    event TrienKhaiDaLuu(address indexed cuocBauCu, address indexed phieuBau, address thanhTuu);
    event TrienKhaiDaXoa(address indexed cuocBauCu);

    function luuTrienKhai(
        QuanLyMapping storage self,
        address quanLyCuocBauCu,
        address quanLyPhieuBau,
        address quanLyThanhTuu // Giữ tham số để emit event, nhưng không lưu
    ) internal {
        require(quanLyCuocBauCu != address(0), "QuanLyCuocBauCu khong hop le: Dia chi Zero");
        require(quanLyPhieuBau != address(0), "QuanLyPhieuBau khong hop le: Dia chi Zero");
        require(quanLyThanhTuu != address(0), "QuanLyThanhTuu khong hop le: Dia chi Zero");
        require(quanLyCuocBauCu.code.length > 0, "QuanLyCuocBauCu khong phai hop dong");
        require(quanLyPhieuBau.code.length > 0, "QuanLyPhieuBau khong phai hop dong");
        require(quanLyThanhTuu.code.length > 0, "QuanLyThanhTuu khong phai hop dong");
        require(self.cuocBauCuDenPhieuBau[quanLyCuocBauCu] == address(0), "CuocBauCu da ton tai");

        self.cuocBauCuDenPhieuBau[quanLyCuocBauCu] = quanLyPhieuBau;

        emit TrienKhaiDaLuu(quanLyCuocBauCu, quanLyPhieuBau, quanLyThanhTuu);
    }

    function xoaTrienKhai(QuanLyMapping storage self, address quanLyCuocBauCu) internal {
        require(quanLyCuocBauCu != address(0), "QuanLyCuocBauCu khong hop le: Dia chi Zero");
        address quanLyPhieuBau = self.cuocBauCuDenPhieuBau[quanLyCuocBauCu];
        require(quanLyPhieuBau != address(0), "CuocBauCu khong ton tai");

        delete self.cuocBauCuDenPhieuBau[quanLyCuocBauCu];

        emit TrienKhaiDaXoa(quanLyCuocBauCu);
    }

    function layPhieuBau(QuanLyMapping storage self, address cuocBauCu) external view returns (address) {
        return self.cuocBauCuDenPhieuBau[cuocBauCu];
    }
}