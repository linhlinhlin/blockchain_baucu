using WebApplication3.Models;

namespace WebApplication3.Services
{
    public interface IFileService
    {
        Task<UploadFileOutputDTO> UploadFileAsync(UploadFileInputDTO inputDto);
        Task<IEnumerable<UploadFileOutputDTO>> GetAllFilesAsync();
        Task<IEnumerable<AzureBlobItemDTO>> GetAllAzureFilesAsync();

    }
}
