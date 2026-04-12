using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using WebApplication3.Models;

namespace WebApplication3.Services
{
    public class AzureBlobService : IAzureBlobService
    {
        private readonly BlobServiceClient _blobServiceClient;
        private readonly string _containerName;
        private readonly string _storageAccountName;
        private readonly string _storageAccountKey;

        public AzureBlobService(IConfiguration configuration)
        {
            // Lấy ConnectionString và ContainerName từ appsettings.json
            var connectionString = configuration["AzureStorage:ConnectionString"];
            var containerName = configuration["AzureStorage:ContainerName"];

            if (string.IsNullOrEmpty(connectionString))
            {
                throw new ArgumentNullException("ConnectionString không được để trống.");
            }
            if (string.IsNullOrEmpty(containerName))
            {
                throw new ArgumentNullException("ContainerName không được để trống.");
            }

            _blobServiceClient = new BlobServiceClient(connectionString);
            _containerName = containerName;

            // Lấy Account Name và Account Key từ ConnectionString (đảm bảo ConnectionString theo định dạng chuẩn)
            var blobUri = new BlobServiceClient(connectionString).Uri;
            _storageAccountName = blobUri.Host.Split('.')[0]; // Lấy tên tài khoản từ URL, ví dụ: "youraccount"
            _storageAccountKey = connectionString.Split("AccountKey=")[1].Split(';')[0]; // Lấy AccountKey
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);
            var blobClient = containerClient.GetBlobClient(fileName);
            var blobHttpHeaders = new BlobHttpHeaders { ContentType = contentType };

            await blobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders
            });

            return GenerateSasToken(fileName);
        }

        public string GenerateSasToken(string fileName, int expiryMinutes = 30)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(fileName);

            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = _containerName,
                BlobName = fileName,
                Resource = "b",
                StartsOn = DateTimeOffset.UtcNow,
                ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes)
            };

            sasBuilder.SetPermissions(BlobSasPermissions.Read | BlobSasPermissions.Write | BlobSasPermissions.Delete);

            if (string.IsNullOrEmpty(_storageAccountKey))
            {
                throw new InvalidOperationException("Storage Account Key không tồn tại, không thể tạo SAS Token.");
            }

            var credential = new StorageSharedKeyCredential(_storageAccountName, _storageAccountKey);
            var sasToken = sasBuilder.ToSasQueryParameters(credential).ToString();

            return $"{blobClient.Uri}?{sasToken}";
        }

        public async Task<IEnumerable<AzureBlobItemDTO>> GetAllBlobsAsync()
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobItems = new List<AzureBlobItemDTO>();

            await foreach (BlobItem blobItem in containerClient.GetBlobsAsync())
            {
                blobItems.Add(new AzureBlobItemDTO
                {
                    FileName = blobItem.Name,
                    Url = $"{containerClient.Uri}/{blobItem.Name}"
                });
            }

            return blobItems;
        }

        public async Task<string> GenerateBlobUrl(string fileName)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(fileName);
            return blobClient.Uri.ToString();
        }

        public async Task DeleteBlobAsync(string fileName)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(fileName);
            await blobClient.DeleteIfExistsAsync();
        }

        public async Task<bool> BlobExistsAsync(string fileName)
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobClient = containerClient.GetBlobClient(fileName);
            var existsResponse = await blobClient.ExistsAsync();
            return existsResponse.Value;
        }
    }
}

