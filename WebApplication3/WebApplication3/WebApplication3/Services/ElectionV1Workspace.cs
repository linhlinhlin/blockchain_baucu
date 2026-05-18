namespace WebApplication3.Services;

public static class ElectionV1Workspace
{
    public static string ResolveContractsRootPath(string? configuredPath, string contentRootPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.GetFullPath(
                Path.IsPathRooted(configuredPath)
                    ? configuredPath
                    : Path.Combine(contentRootPath, configuredPath));
        }

        foreach (var startPath in EnumerateSearchRoots(contentRootPath))
        {
            var directory = new DirectoryInfo(startPath);
            while (directory is not null)
            {
                var candidate = Path.Combine(directory.FullName, "blockchain_sm");
                if (Directory.Exists(candidate))
                {
                    return candidate;
                }

                directory = directory.Parent;
            }
        }

        throw new DirectoryNotFoundException(
            $"Khong tim thay thu muc blockchain_sm. Search roots: {string.Join(", ", EnumerateSearchRoots(contentRootPath))}."
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

    private static IReadOnlyList<string> EnumerateSearchRoots(string contentRootPath)
    {
        var roots = new List<string>();

        void AddRoot(string? path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            var fullPath = Path.GetFullPath(path);
            if (!Directory.Exists(fullPath))
            {
                return;
            }

            if (roots.Any(item => string.Equals(item, fullPath, StringComparison.OrdinalIgnoreCase)))
            {
                return;
            }

            roots.Add(fullPath);
        }

        AddRoot(contentRootPath);
        AddRoot(AppContext.BaseDirectory);
        AddRoot(Directory.GetCurrentDirectory());

        return roots;
    }
}
