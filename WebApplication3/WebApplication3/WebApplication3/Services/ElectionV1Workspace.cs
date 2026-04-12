namespace WebApplication3.Services;

public static class ElectionV1Workspace
{
    public static string ResolveContractsRootPath(string? configuredPath, string contentRootPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.GetFullPath(configuredPath);
        }

        var directory = new DirectoryInfo(contentRootPath);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "blockchain_sm");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Khong tim thay thu muc blockchain_sm bat dau tu {contentRootPath}."
        );
    }

    public static string ResolvePathFromContractsRoot(string contractsRootPath, string? configuredValue, params string[] fallbackSegments)
    {
        if (!string.IsNullOrWhiteSpace(configuredValue))
        {
            return Path.GetFullPath(
                Path.IsPathRooted(configuredValue)
                    ? configuredValue
                    : Path.Combine(contractsRootPath, configuredValue)
            );
        }

        return Path.GetFullPath(Path.Combine(new[] { contractsRootPath }.Concat(fallbackSegments).ToArray()));
    }
}
