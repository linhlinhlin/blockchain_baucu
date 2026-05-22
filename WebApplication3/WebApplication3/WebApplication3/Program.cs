using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.RateLimiting;
using System.Text;
using System.Threading.RateLimiting;
using WebApplication3;
using WebApplication3.Controllers;
using WebApplication3.Data;
using WebApplication3.Infrastructure;
using WebApplication3.Models;
using WebApplication3.Repositories;
using WebApplication3.Services;

// Other using statements...

static bool LooksLikePostgresConnectionString(string? connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return false;
    }

    return connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Username=", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("SSL Mode=", StringComparison.OrdinalIgnoreCase);
}

var builder = WebApplication.CreateBuilder(args);
Console.OutputEncoding = Encoding.UTF8;
Console.InputEncoding = Encoding.UTF8;

var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");
var electionV1StoreConnection = builder.Configuration.GetConnectionString("ElectionV1StoreConnection");
var electionV1StoreProvider = builder.Configuration["ElectionV1StoreSettings:Provider"]?.Trim();
var developmentAuthEnabled = builder.Configuration.GetValue<bool>("DevelopmentAuthSettings:Enabled");
var useDevelopmentInMemoryDatabase = string.IsNullOrWhiteSpace(defaultConnection)
    || (builder.Environment.IsDevelopment() && developmentAuthEnabled);

// S3 (spec 001): KHONG dung secret hardcode. Fail-fast neu thieu / qua ngan.
var configuredJwtSecret = builder.Configuration["JwtSettings:Secret"];
if (string.IsNullOrWhiteSpace(configuredJwtSecret) || configuredJwtSecret.Trim().Length < 32)
{
    throw new InvalidOperationException(
        "JwtSettings:Secret chua duoc cau hinh hoac qua ngan (yeu cau >=32 ky tu). " +
        "Cau hinh qua bien moi truong 'JwtSettings__Secret', 'dotnet user-secrets', " +
        "hoac appsettings.Development.json (xem appsettings.Development.json.example). " +
        "Khong duoc dung gia tri hardcode. (spec 001 / S3)");
}

if (useDevelopmentInMemoryDatabase)
{
    if (string.IsNullOrWhiteSpace(builder.Configuration["JwtSettings:Issuer"]))
    {
        builder.Configuration["JwtSettings:Issuer"] = "HoLiHu.Local";
    }

    if (string.IsNullOrWhiteSpace(builder.Configuration["JwtSettings:Audience"]))
    {
        builder.Configuration["JwtSettings:Audience"] = "HoLiHu.Local.Client";
    }

    if (!int.TryParse(builder.Configuration["JwtSettings:AccessTokenExpirationMinutes"], out var accessMinutes) || accessMinutes <= 0)
    {
        builder.Configuration["JwtSettings:AccessTokenExpirationMinutes"] = "120";
    }

    if (!int.TryParse(builder.Configuration["JwtSettings:RefreshTokenExpirationDays"], out var refreshDays) || refreshDays <= 0)
    {
        builder.Configuration["JwtSettings:RefreshTokenExpirationDays"] = "7";
    }
}

// Đăng ký các dịch vụ cho ứng dụng
builder.Services.AddControllersWithViews();
builder.Services.AddControllers();
builder.Services
    .AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(
        builder.Environment.ContentRootPath,
        "App_Data",
        "DataProtectionKeys")));



builder.Services.AddTransient<EmailService>();
builder.Services.AddTransient<RazorViewToStringRenderer>();
builder.Services.AddSingleton<IUrlHelperFactory, UrlHelperFactory>();

// Add services to the container.
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services.AddSingleton<JwtService>();

// Other service registrations...

// Azure Blob Storage
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<IAzureBlobService, AzureBlobService>();
builder.Services.AddScoped<IFileRepository, FileRepository>();

// Thêm HttpClient factory cho RecaptchaService
builder.Services.AddHttpClient();
builder.Services.AddScoped<RecaptchaService>();

builder.Services.AddScoped<OtpController>();
builder.Services.AddSingleton<ElectionV1ReadService>();
builder.Services.AddScoped<ElectionV1CreateService>();
builder.Services.AddScoped<ElectionV1RosterService>();
builder.Services.AddScoped<DevelopmentAuthStore>();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSingleton<WalletLoginChallengeService>();
builder.Services.AddWalletLookupServices();

builder.Services.AddScoped<PinataService>();




// Cấu hình Swagger
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "API của tôi",
        Version = "v1"
    });
    c.OperationFilter<FileUploadOperationFilter>();

});

// Cấu hình xác thực JWT
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuredJwtSecret)),
        ClockSkew = TimeSpan.Zero // Giảm thời gian lệch giữa máy chủ và token
    };
});


builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (useDevelopmentInMemoryDatabase)
    {
        options
            .UseInMemoryDatabase("HoLiHuVotingDev")
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        return;
    }

    // S12 (spec 005): provider-aware (mở đường SQL Server -> PostgreSQL).
    // Default vẫn SQL Server (tương thích ngược); Postgres khi connection string là Postgres.
    if (LooksLikePostgresConnectionString(defaultConnection))
    {
        options.UseNpgsql(defaultConnection);
        return;
    }

    options.UseSqlServer(
        defaultConnection,
        sqlOptions => sqlOptions.EnableRetryOnFailure());
});

builder.Services.AddDbContext<ElectionV1StoreDbContext>(options =>
{
    if (string.Equals(electionV1StoreProvider, "postgres", StringComparison.OrdinalIgnoreCase)
        || LooksLikePostgresConnectionString(electionV1StoreConnection))
    {
        if (string.IsNullOrWhiteSpace(electionV1StoreConnection))
        {
            throw new InvalidOperationException("ElectionV1StoreConnection chua duoc cau hinh cho PostgreSQL.");
        }

        options.UseNpgsql(electionV1StoreConnection);
        return;
    }

    if (string.Equals(electionV1StoreProvider, "sqlserver", StringComparison.OrdinalIgnoreCase))
    {
        if (string.IsNullOrWhiteSpace(electionV1StoreConnection))
        {
            throw new InvalidOperationException("ElectionV1StoreConnection chua duoc cau hinh cho SQL Server.");
        }

        options.UseSqlServer(
            electionV1StoreConnection,
            sqlOptions => sqlOptions.EnableRetryOnFailure());
        return;
    }

    if (string.Equals(electionV1StoreProvider, "inmemory", StringComparison.OrdinalIgnoreCase)
        || string.IsNullOrWhiteSpace(electionV1StoreConnection))
    {
        options
            .UseInMemoryDatabase("ElectionV1RosterDev")
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        return;
    }

    options.UseSqlServer(
        electionV1StoreConnection,
        sqlOptions => sqlOptions.EnableRetryOnFailure());
});


// cau hinh pinata
builder.Services.AddHttpClient("Pinata", client =>
{
    client.BaseAddress = new Uri("https://api.pinata.cloud/");
    client.DefaultRequestHeaders.Add("pinata_api_key", builder.Configuration["Pinata:ApiKey"]);
    client.DefaultRequestHeaders.Add("pinata_secret_api_key", builder.Configuration["Pinata:ApiSecret"]);
});

// S10 (spec 002): allowed origins tu config/env, KHONG hardcode origin production/azure.
// Cau hinh: Cors:AllowedOrigins (mang) qua appsettings/env (Cors__AllowedOrigins__0=...).
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (corsOrigins is null || corsOrigins.Length == 0)
{
    corsOrigins = new[]
    {
        "http://localhost:3000", "https://localhost:3000",
        "http://127.0.0.1:3000", "https://127.0.0.1:3000",
    };
}
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins(corsOrigins)
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
    });
});

// S6 (spec 002): rate-limit endpoint nhay cam (voter-invites/*) chong spam/brute-force.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("voter-invites", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

// Đọc cấu hình JWT từ appsettings.json
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings.GetValue<string>("Secret") ?? throw new ArgumentNullException("Secret key is not configured in appsettings.json");
var issuer = jwtSettings.GetValue<string>("Issuer") ?? throw new ArgumentNullException("Issuer is not configured in appsettings.json");
var audience = jwtSettings.GetValue<string>("Audience") ?? throw new ArgumentNullException("Audience is not configured in appsettings.json");
var accessTokenExpirationMinutes = jwtSettings.GetValue<int>("AccessTokenExpirationMinutes");
var refreshTokenExpirationDays = jwtSettings.GetValue<int>("RefreshTokenExpirationDays");

// Cấu hình Logging
builder.Logging.ClearProviders();
builder.Logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var app = builder.Build();



using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
    var databaseProviderName = dbContext.Database.ProviderName;
    try
    {
        if (string.Equals(databaseProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal))
        {
            logger.LogWarning("Using development in-memory database. SQL initialization skipped.");
        }
        else if (app.Environment.IsDevelopment() && developmentAuthEnabled)
        {
            logger.LogWarning("DevelopmentAuthSettings:Enabled=true, skipping database initialization.");
        }
        else if (app.Environment.IsDevelopment())
        {
            await dbContext.Database.EnsureCreatedAsync();
            await DevelopmentDatabaseInitializer.InitializeAsync(dbContext, logger);
            logger.LogInformation("Development database created and seeded successfully.");
        }
        else
        {
            dbContext.Database.OpenConnection();
            logger.LogInformation("SQL Server connection opened successfully.");
            dbContext.Database.CloseConnection();
        }

        var electionV1StoreContext = scope.ServiceProvider.GetRequiredService<ElectionV1StoreDbContext>();
        await electionV1StoreContext.Database.EnsureCreatedAsync();
        logger.LogInformation(
            "ElectionV1 store is ready with provider {Provider}.",
            electionV1StoreContext.Database.ProviderName);

        if (developmentAuthEnabled)
        {
            var developmentAuthStore = scope.ServiceProvider.GetRequiredService<DevelopmentAuthStore>();
            await developmentAuthStore.EnsureSeedAsync();
            logger.LogInformation("Development auth store seeded.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to initialize database.");
        throw;
    }
}

// Cấu hình Swagger
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "API của tôi v1");
        c.RoutePrefix = string.Empty; // Swagger UI nằm ở trang gốc

    });
   
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts(); // Sử dụng HSTS trong môi trường production
}


if (!builder.Configuration.GetValue<bool>("AppSettings:DisableHttpsRedirection"))
{
    app.UseHttpsRedirection();
}
app.UseStaticFiles(); // Phục vụ file tĩnh
app.UseRouting();
app.UseRateLimiter(); // S6: sau UseRouting de policy theo endpoint hoat dong
app.UseCors("AllowReactApp"); // Đặt sau UseRouting() và trước Authentication
app.UseAuthentication(); // Middleware Authentication
app.UseAuthorization(); // Middleware Authorization

//Map route cho Controller
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
//app.MapControllerRoute(
//    name: "api",
//    pattern: "api/{controller}/{action=Index}/{id?}");

app.MapControllers(); // Thêm dòng này để map các controller

// S15 (spec 004): health endpoint cho Docker healthcheck (không cần auth).
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

// Chạy ứng dụng
app.Run();
