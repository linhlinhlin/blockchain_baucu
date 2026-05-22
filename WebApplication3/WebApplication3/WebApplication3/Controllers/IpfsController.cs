using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace WebApplication3.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IpfsController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<IpfsController> _logger;
        private readonly string _pinataApiKey;
        private readonly string _pinataApiSecret;

        public IpfsController(
            IHttpClientFactory httpClientFactory,
            ILogger<IpfsController> logger,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _pinataApiKey = configuration["Pinata:ApiKey"] ?? string.Empty;
            _pinataApiSecret = configuration["Pinata:ApiSecret"] ?? string.Empty;
        }

        /// <summary>
        /// Upload an image file to Pinata (IPFS) and return the CID and gateway URL.
        /// </summary>
        /// <param name="image">The image file from form-data (field name "image").</param>
        [HttpPost("upload")]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> Upload(IFormFile image)
        {
            if (image == null || image.Length == 0)
                return BadRequest(new { success = false, message = "No file provided." });

            try
            {
                // Create HttpClient configured for Pinata
                var client = _httpClientFactory.CreateClient();
                client.BaseAddress = new Uri("https://api.pinata.cloud/");
                client.DefaultRequestHeaders.Add("pinata_api_key", _pinataApiKey);
                client.DefaultRequestHeaders.Add("pinata_secret_api_key", _pinataApiSecret);

                // Prepare multipart/form-data content
                using var content = new MultipartFormDataContent();
                using var stream = image.OpenReadStream();
                var fileContent = new StreamContent(stream);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue(image.ContentType);
                content.Add(fileContent, "file", image.FileName);

                // Send request to Pinata
                var response = await client.PostAsync("pinning/pinFileToIPFS", content);
                var json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Pinata API error ({StatusCode}): {Response}", response.StatusCode, json);
                    return StatusCode(StatusCodes.Status502BadGateway, new
                    {
                        success = false,
                        message = "Pinata API returned an error.",
                        details = json
                    });
                }

                // Parse response
                var obj = JObject.Parse(json);
                var cid = obj["IpfsHash"]?.ToString();
                if (string.IsNullOrEmpty(cid))
                {
                    _logger.LogError("Pinata API returned no IpfsHash: {Response}", json);
                    return StatusCode(StatusCodes.Status500InternalServerError, new
                    {
                        success = false,
                        message = "Invalid response from Pinata."
                    });
                }

                var gatewayUrl = $"https://gateway.pinata.cloud/ipfs/{cid}";

                return Ok(new
                {
                    success = true,
                    cid,
                    url = gatewayUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while uploading to Pinata");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    success = false,
                    message = "Internal server error.",
                    details = ex.Message
                });
            }
        }
    }
}
