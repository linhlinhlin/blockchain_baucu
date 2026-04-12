using System.ComponentModel.DataAnnotations;

namespace WebApplication3.Models
{
    public class DeployBlockchainRequest
    {
        [Required(ErrorMessage = "Địa chỉ SCW là bắt buộc.")]
        [RegularExpression(@"^0x[a-fA-F0-9]{40}$", ErrorMessage = "Địa chỉ SCW không hợp lệ.")]
        public string SCWAddress { get; set; } = null!;
    }
}
