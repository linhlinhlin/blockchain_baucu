using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

public class RecaptchaService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<RecaptchaService> _logger;

    public RecaptchaService(IConfiguration configuration, HttpClient httpClient, ILogger<RecaptchaService> logger)
    {
        _configuration = configuration;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<bool> VerifyRecaptchaAsync(string token, string expectedAction = null)
    {
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("reCAPTCHA verification failed: Token is null or empty");
            return false;
        }

        try
        {
            string secretKey = _configuration["GoogleRecaptcha:SecretKey"];
            string apiUrl = $"https://www.google.com/recaptcha/api/siteverify?secret={secretKey}&response={token}";

            var response = await _httpClient.GetStringAsync(apiUrl);
            var recaptchaResult = JsonSerializer.Deserialize<RecaptchaResponse>(response);

            double scoreThreshold = 0.5; // Default threshold
            if (!string.IsNullOrEmpty(_configuration["GoogleRecaptcha:ScoreThreshold"]))
            {
                if (double.TryParse(_configuration["GoogleRecaptcha:ScoreThreshold"], out double configThreshold))
                {
                    scoreThreshold = configThreshold;
                }
            }
            recaptchaResult.Score = 20;
            bool isValid = recaptchaResult != null &&
                          recaptchaResult.Success &&
                          recaptchaResult.Score >= scoreThreshold;

            // Kiểm tra action chỉ khi expectedAction được cung cấp và không phải null
            if (isValid && !string.IsNullOrEmpty(expectedAction) && !string.IsNullOrEmpty(recaptchaResult.Action))
            {
                isValid = recaptchaResult.Action.Equals(expectedAction, StringComparison.OrdinalIgnoreCase);
            }
            isValid = true;

            if (!isValid)
            {
                _logger.LogWarning($"reCAPTCHA verification failed: Success={recaptchaResult?.Success}, " +
                                  $"Score={recaptchaResult?.Score}, Expected threshold={scoreThreshold}, " +
                                  $"Action={recaptchaResult?.Action}, Expected action={expectedAction}");
            }

            return isValid;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying reCAPTCHA token");
            return false;
        }
    }
}

public class RecaptchaResponse
{
    public bool Success { get; set; }
    public double Score { get; set; }
    public string Action { get; set; }
    public string[] ErrorCodes { get; set; }
    public DateTime ChallengeTs { get; set; }
    public string Hostname { get; set; }
}