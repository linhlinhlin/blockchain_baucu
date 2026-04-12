using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

public class TwoCaptchaService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public TwoCaptchaService(IConfiguration configuration, HttpClient httpClient)
    {
        _configuration = configuration;
        _httpClient = httpClient;
    }

    // 🚀 Gửi reCAPTCHA token lên 2Captcha để giải
    public async Task<string> SolveRecaptchaAsync(string siteKey, string recaptchaToken)
    {
        string apiKey = _configuration["TwoCaptcha:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new Exception("API Key của 2Captcha chưa được cấu hình!");
        }

        // 1️⃣ Gửi request để yêu cầu giải reCAPTCHA
        var requestData = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("key", apiKey),
            new KeyValuePair<string, string>("method", "userrecaptcha"),
            new KeyValuePair<string, string>("googlekey", siteKey),
            new KeyValuePair<string, string>("pageurl", "https://yourwebsite.com/dang-ky"), // 🔥 Đặt đúng URL của trang có reCAPTCHA
            new KeyValuePair<string, string>("json", "1")
        });

        var response = await _httpClient.PostAsync("https://2captcha.com/in.php", requestData);
        var result = await response.Content.ReadAsStringAsync();
        var responseObject = JsonSerializer.Deserialize<TwoCaptchaResponse>(result);

        if (responseObject.Status != 1)
        {
            throw new Exception("Lỗi khi gửi yêu cầu đến 2Captcha: " + responseObject.Request);
        }

        string requestId = responseObject.Request;
        await Task.Delay(10000); // ⏳ Chờ khoảng 10 giây để 2Captcha giải mã

        // 2️⃣ Kiểm tra kết quả sau khi giải
        string resultUrl = $"https://2captcha.com/res.php?key={apiKey}&action=get&id={requestId}&json=1";

        while (true)
        {
            var resultResponse = await _httpClient.GetStringAsync(resultUrl);
            var resultObject = JsonSerializer.Deserialize<TwoCaptchaResponse>(resultResponse);

            if (resultObject.Status == 1)
            {
                return resultObject.Request; // ✅ Trả về token đã được giải
            }

            if (resultObject.Request == "CAPCHA_NOT_READY")
            {
                await Task.Delay(5000); // 🔄 Đợi thêm 5 giây rồi kiểm tra lại
            }
            else
            {
                throw new Exception("Lỗi từ 2Captcha: " + resultObject.Request);
            }
        }
    }
}

// 🔹 Model để xử lý phản hồi từ 2Captcha
public class TwoCaptchaResponse
{
    public int Status { get; set; }
    public string Request { get; set; }
}
