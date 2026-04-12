using DocumentFormat.OpenXml.Office2016.Drawing.ChartDrawing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using WebApplication3;
using WebApplication3.Controllers;
using WebApplication3.Data;
using WebApplication3.Infrastructure;
using WebApplication3.Models;
using WebApplication3.Repositories;
using WebApplication3.Service;
using WebApplication3.Services;

// Other using statements...

var builder = WebApplication.CreateBuilder(args);

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

// Thêm CryptoService
builder.Services.AddScoped<CryptoService>();

builder.Services.AddScoped<OtpController>();
builder.Services.AddSingleton<ElectionV1ReadService>();
builder.Services.AddScoped<ElectionV1CreateService>();
builder.Services.Configure<LegacyBlockchainSettings>(
    builder.Configuration.GetSection("LegacyBlockchainSettings"));
builder.Services.AddLegacyBlockchainStack(builder.Configuration);

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

#pragma warning disable CS8604 
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"])),
        ClockSkew = TimeSpan.Zero // Giảm thời gian lệch giữa máy chủ và token
    };
#pragma warning restore CS8604 // Possible null reference argument.
});


// Cấu hình DbContext
var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");
var developmentAuthEnabled = builder.Configuration.GetValue<bool>("DevelopmentAuthSettings:Enabled");
var useDevelopmentInMemoryDatabase = string.IsNullOrWhiteSpace(defaultConnection)
    || (builder.Environment.IsDevelopment() && developmentAuthEnabled);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (useDevelopmentInMemoryDatabase)
    {
        options.UseInMemoryDatabase("HoLiHuVotingDev");
        return;
    }

    options.UseSqlServer(
        defaultConnection,
        sqlOptions => sqlOptions.EnableRetryOnFailure());
});


// cau hinh pinata
builder.Services.AddHttpClient("Pinata", client =>
{
    client.BaseAddress = new Uri("https://api.pinata.cloud/");
    client.DefaultRequestHeaders.Add("pinata_api_key", builder.Configuration["Pinata:ApiKey"]);
    client.DefaultRequestHeaders.Add("pinata_secret_api_key", builder.Configuration["Pinata:ApiSecret"]);
});

// Đăng ký AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

// Đăng ký CORS cho phép kết nối với React App
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins(
             "http://localhost:3000",
             "https://localhost:3000",
             "http://127.0.0.1:3000",
             "https://127.0.0.1:3000",
             "http://localhost:3200",
             "https://localhost:3200",
             "http://127.0.0.1:3200",
             "https://127.0.0.1:3200",
             "https://holihu.online",
             "https://app.holihu.online", // Nếu frontend chạy trên subdomain
             "https://webapplication320250413035557-eebmacambhenb2ha.australiacentral-01.azurewebsites.net" // Thêm Azure domain nếu cần
         )// Cho phép cả subdomain
                 .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
    });
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



app.UseHttpsRedirection();
app.UseStaticFiles(); // Phục vụ file tĩnh
app.UseRouting();
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
// Chạy ứng dụng
app.Run();
