using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
namespace WebApplication3.Services
{
    public class PinataService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<PinataService> _logger;

        public PinataService(IHttpClientFactory httpClientFactory, ILogger<PinataService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<(bool Success, string Cid, string Url, string Error)> UploadImageAsync(IFormFile file)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("Pinata");

                using var content = new MultipartFormDataContent();
                using var stream = file.OpenReadStream();
                var fileContent = new StreamContent(stream);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
                content.Add(fileContent, "file", file.FileName);

                // Gọi API pinFileToIPFS
                var response = await client.PostAsync("pinning/pinFileToIPFS", content);
                var json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Pinata error: {Json}", json);
                    return (false, null, null, $"Pinata API returned {(int)response.StatusCode}");
                }

                var obj = JObject.Parse(json);
                var cid = obj["IpfsHash"]?.ToString();
                var url = $"https://gateway.pinata.cloud/ipfs/{cid}";

                return (true, cid, url, null);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Exception when uploading to Pinata");
                return (false, null, null, ex.Message);
            }
        }
    }

}
