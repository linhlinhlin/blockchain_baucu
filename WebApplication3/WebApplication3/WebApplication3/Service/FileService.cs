using WebApplication3.Models;
using WebApplication3.Repositories;

namespace WebApplication3.Services
{
    public class FileService : IFileService
    {
        private readonly IAzureBlobService _azureBlobService;
        private readonly IFileRepository _fileRepository;
        public FileService(IAzureBlobService azureBlobService, IFileRepository fileRepository)
        {
            _azureBlobService = azureBlobService;
            _fileRepository = fileRepository;
        }

        public async Task<UploadFileOutputDTO> UploadFileAsync(UploadFileInputDTO inputDto)
        {
            if (inputDto.File == null || inputDto.File.Length == 0)
                throw new ArgumentException("File không hợp lệ");

            var fileName = Path.GetFileName(inputDto.File.FileName);
            var contentType = inputDto.File.ContentType;
            var fileStream = inputDto.File.OpenReadStream();

            var fileUrl = await _azureBlobService.UploadFileAsync(fileStream, fileName, contentType);
            Console.WriteLine("Upload file to Azure Blob Storage", fileUrl);

            var uploadTimeUtc = DateTimeOffset.UtcNow;
            var uploadTimeUtc7 = uploadTimeUtc.ToOffset(TimeSpan.FromHours(7));

            var uploadFile = new UploadFile
            {
                FileURL = fileUrl,
                TenFileDuocTao = fileName,
                TenFileGoc = fileName,
                NoiDungType = contentType,
                KichThuoc = inputDto.File.Length,
                NgayUpload = uploadTimeUtc.UtcDateTime,
                TaiKhoanUploadId = inputDto.TaiKhoanUploadId,
                PhienBauCuUploadId = inputDto.PhienBauCuUploadId,
                CuocBauCuUploadId = inputDto.CuocBauCuUploadId,
                KichThuocHienThi = FormatFileSize(inputDto.File.Length),
                NgayHienThi = uploadTimeUtc7.ToString("dd/MM/yyyy HH:mm")
            };

            Console.WriteLine("Upload file to database", uploadFile);

            await _fileRepository.AddAsync(uploadFile);

            var outputDto = new UploadFileOutputDTO
            {
                TenFileDuocTao = fileName,
                TenFileGoc = fileName,
                FileUrl = fileUrl,
                NoiDungType = contentType,
                KichThuoc = inputDto.File.Length,
                NgayUpload = uploadTimeUtc,
                KichThuocHienThi = FormatFileSize(inputDto.File.Length),
                NgayHienThi = uploadTimeUtc7.ToString("dd/MM/yyyy HH:mm")
            };

            return outputDto;
        }

        private string FormatFileSize(long bytes)
        {
            if (bytes >= 1048576)
                return $"{bytes / 1048576.0:F2} MB";
            else if (bytes >= 1024)
                return $"{bytes / 1024.0:F2} KB";
            else
                return $"{bytes} bytes";
        }

        public async Task<IEnumerable<UploadFileOutputDTO>> GetAllFilesAsync()
        {
            var files = await _fileRepository.GetAllAsync();
            return files.Select(file => new UploadFileOutputDTO
            {
                TenFileDuocTao = file.TenFileDuocTao,
                TenFileGoc = file.TenFileGoc,
                FileUrl = file.FileURL,
                NoiDungType = file.NoiDungType,
                KichThuoc = file.KichThuoc,
                NgayUpload = new DateTimeOffset(DateTime.SpecifyKind(file.NgayUpload, DateTimeKind.Utc)),
                KichThuocHienThi = file.KichThuocHienThi,
                NgayHienThi = file.NgayHienThi
            }).ToList();
        }

        public async Task<IEnumerable<AzureBlobItemDTO>> GetAllAzureFilesAsync()
        {
            return await _azureBlobService.GetAllBlobsAsync();
        }
    }
}
