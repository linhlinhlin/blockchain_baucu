using AutoMapper;
using WebApplication3.Models;

namespace WebApplication3.Models
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<VaiTro, VaiTro>();
            CreateMap<TaiKhoan, TaiKhoanDTO>();
            CreateMap<TaiKhoan, TaiKhoanNoRefreshTokenDTO>()
               .ForMember(dest => dest.VaiTro, opt => opt.Ignore()); // Bỏ qua thuộc tính VaiTro vì nó sẽ được gán thủ công

            // Thêm mapping cho UploadFile và UploadFileDTO
            CreateMap<UploadFile, UploadFileDTO>()
                .ForMember(dest => dest.TenFileDuocTao, opt => opt.MapFrom(src => src.TenFileDuocTao))
                .ForMember(dest => dest.TenFileGoc, opt => opt.MapFrom(src => src.TenFileGoc))
                .ForMember(dest => dest.FileUrl, opt => opt.MapFrom(src => src.FileURL))
                .ForMember(dest => dest.NoiDungType, opt => opt.MapFrom(src => src.NoiDungType))
                .ForMember(dest => dest.KichThuoc, opt => opt.MapFrom(src => src.KichThuoc))
                .ForMember(dest => dest.NgayHienThi, opt => opt.MapFrom(src => src.NgayHienThi))
                .ForMember(dest => dest.NgayUpload, opt => opt.MapFrom(src => src.NgayUpload))
                .ForMember(dest => dest.KichThuocHienThi, opt => opt.MapFrom(src => src.KichThuocHienThi));

        }
    }
}