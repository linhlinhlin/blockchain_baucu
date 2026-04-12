using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using WebApplication3.Models; // Add this using directive

namespace WebApplication3.Services
{
    public interface IAzureBlobService
    {
        Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType);
        // Phương thức mới để lấy danh sách blob
        Task<IEnumerable<AzureBlobItemDTO>> GetAllBlobsAsync();
        // Phương thức mới để xóa blob
        Task DeleteBlobAsync(string fileName); // Khai báo phương thức DeleteBlobAsync
        Task<bool> BlobExistsAsync(string fileName);
        // Thêm phương thức GenerateSasToken vào interface
        string GenerateSasToken(string fileName, int expiryMinutes = 30);
        Task<string> GenerateBlobUrl(string fileName);

    }
}
