using MailKit.Net.Smtp;
using MimeKit;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

public class EmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string email, string subject, string message)
    {
        var emailMessage = new MimeMessage();
        emailMessage.From.Add(new MailboxAddress("HoLiHu", _configuration["Smtp:Username"]));
        emailMessage.To.Add(new MailboxAddress("", email));
        emailMessage.Subject = subject;
        emailMessage.Body = new TextPart("html") { Text = message };

        using (var client = new SmtpClient())
        {
            var host = _configuration["Smtp:Host"];
            var portString = _configuration["Smtp:Port"];
            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(portString) || !int.TryParse(portString, out var port))
            {
                throw new InvalidOperationException("SMTP configuration is invalid.");
            }

            await client.ConnectAsync(host, port, false);
            await client.AuthenticateAsync(_configuration["Smtp:Username"], _configuration["Smtp:Password"]);
            await client.SendAsync(emailMessage);
            await client.DisconnectAsync(true);
        }
    }
}
