FROM node:20-bookworm-slim AS contracts
WORKDIR /workspace/blockchain_sm
COPY blockchain_sm/package*.json ./
RUN npm install --legacy-peer-deps
COPY blockchain_sm/ ./

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY WebApplication3/WebApplication3/WebApplication3/WebApplication3.csproj WebApplication3/WebApplication3/WebApplication3/
RUN dotnet restore "WebApplication3/WebApplication3/WebApplication3/WebApplication3.csproj"
COPY WebApplication3/WebApplication3/WebApplication3/ WebApplication3/WebApplication3/WebApplication3/
RUN dotnet publish "WebApplication3/WebApplication3/WebApplication3/WebApplication3.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0
RUN apt-get update \
    && apt-get install -y curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish/ ./
COPY --from=contracts /workspace/blockchain_sm /workspace/blockchain_sm

# S16 (spec 004): chay non-root. User `app` (uid 1654) co san trong image aspnet .NET 9.
# S15: dam bao thu muc deployments ton tai & thuoc `app` de named volume khoi tao dung quyen.
RUN mkdir -p /workspace/blockchain_sm/deployments \
    && chown -R app:app /app /workspace/blockchain_sm
USER app

ENV ASPNETCORE_URLS=http://0.0.0.0:5293
EXPOSE 5293

ENTRYPOINT ["dotnet", "WebApplication3.dll"]
