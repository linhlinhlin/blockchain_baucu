using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Configuration;

public class EmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string email, string subject, string message, CancellationToken cancellationToken = default)
    {
        var host = _configuration["Smtp:Host"]?.Trim();
        var portString = _configuration["Smtp:Port"]?.Trim();
        var username = _configuration["Smtp:Username"]?.Trim();
        var password = _configuration["Smtp:Password"];
        var fromEmail = _configuration["Smtp:FromEmail"]?.Trim();
        var fromName = _configuration["Smtp:FromName"]?.Trim();

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(portString) || !int.TryParse(portString, out var port))
        {
            throw new InvalidOperationException("SMTP host/port is not configured.");
        }

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password) || IsRedactedPlaceholder(password))
        {
            throw new InvalidOperationException("SMTP username/password is not configured.");
        }

        var senderAddress = string.IsNullOrWhiteSpace(fromEmail) ? username : fromEmail;
        var emailMessage = new MimeMessage();
        emailMessage.From.Add(new MailboxAddress(string.IsNullOrWhiteSpace(fromName) ? "HoLiHu" : fromName, senderAddress));
        emailMessage.To.Add(new MailboxAddress("", email));
        emailMessage.Subject = subject;
        emailMessage.Body = new TextPart("html") { Text = message };

        using var client = new SmtpClient
        {
            Timeout = 15000
        };

        await client.ConnectAsync(host, port, ResolveSecureSocketOptions(port), cancellationToken);
        await client.AuthenticateAsync(username, password, cancellationToken);
        await client.SendAsync(emailMessage, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private SecureSocketOptions ResolveSecureSocketOptions(int port)
    {
        var configuredValue = _configuration["Smtp:SecureSocketOptions"]?.Trim();
        if (!string.IsNullOrWhiteSpace(configuredValue)
            && Enum.TryParse<SecureSocketOptions>(configuredValue, ignoreCase: true, out var configuredOption))
        {
            return configuredOption;
        }

        return port switch
        {
            465 => SecureSocketOptions.SslOnConnect,
            587 => SecureSocketOptions.StartTls,
            _ => SecureSocketOptions.StartTlsWhenAvailable
        };
    }

    private static bool IsRedactedPlaceholder(string value)
    {
        var normalized = value.Trim();
        return normalized.Length == 0
            || normalized.Equals("<da_xoa>", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("changeme", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("change-me", StringComparison.OrdinalIgnoreCase);
    }
}
