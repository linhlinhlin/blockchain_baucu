public class TokenRequestDTO
{
    public string? AccessToken { get; set; }
}
public class RevokeTokenDTO
{
    public string? RefreshToken { get; set; }
}