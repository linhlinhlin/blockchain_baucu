using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
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

    public async Task<bool> VerifyRecaptchaAsync(string token, string? expectedAction = null)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("reCAPTCHA verification failed: token is empty");
            return false;
        }

        var secretKey = _configuration["RecaptchaSettings:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.StartsWith("<", StringComparison.Ordinal))
        {
            _logger.LogError("reCAPTCHA verification failed: RecaptchaSettings:SecretKey is not configured");
            return false;
        }

        try
        {
            using var requestContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("secret", secretKey),
                new KeyValuePair<string, string>("response", token)
            });

            using var response = await _httpClient.PostAsync(
                "https://www.google.com/recaptcha/api/siteverify",
                requestContent);
            var responseBody = await response.Content.ReadAsStringAsync();
            var recaptchaResult = JsonSerializer.Deserialize<RecaptchaResponse>(
                responseBody,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            var scoreThreshold = _configuration.GetValue<double?>("RecaptchaSettings:ScoreThreshold") ?? 0.5;
            var actionMatches = string.IsNullOrWhiteSpace(expectedAction)
                || string.Equals(recaptchaResult?.Action, expectedAction, StringComparison.OrdinalIgnoreCase);
            var isValid = recaptchaResult is { Success: true }
                && recaptchaResult.Score >= scoreThreshold
                && actionMatches;

            if (!isValid)
            {
                _logger.LogWarning(
                    "reCAPTCHA verification failed: Success={Success}, Score={Score}, Threshold={Threshold}, Action={Action}, ExpectedAction={ExpectedAction}, ErrorCodes={ErrorCodes}",
                    recaptchaResult?.Success,
                    recaptchaResult?.Score,
                    scoreThreshold,
                    recaptchaResult?.Action,
                    expectedAction,
                    string.Join(",", recaptchaResult?.ErrorCodes ?? Array.Empty<string>()));
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
    public string? Action { get; set; }

    [JsonPropertyName("error-codes")]
    public string[] ErrorCodes { get; set; } = Array.Empty<string>();

    [JsonPropertyName("challenge_ts")]
    public DateTime ChallengeTs { get; set; }

    public string? Hostname { get; set; }
}
