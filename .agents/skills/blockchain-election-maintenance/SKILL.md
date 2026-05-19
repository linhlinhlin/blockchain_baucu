---
name: blockchain-election-maintenance
description: Maintain HoLiHu Blockchain Election active ElectionV1 stack. Use for security remediation, Spec Kit work, Solidity contracts, ASP.NET Core ElectionV1 APIs, React/Vite election UX, Docker active stack, audit backlog, or cross-surface changes in blockchain_baucu.
---

# Blockchain Election Maintenance

## Workflow

1. Read root `AGENTS.md`, then the nested `AGENTS.md` for the changed module.
2. Read `docs/CODEBASE_MAP.md` before broad exploration.
3. For security or multi-surface work, read `.specify/memory/constitution.md`, `docs/audit/AUDIT_2026-05-18.md`, and the relevant `.specify/specs/<feature>/` docs.
4. Keep changes surgical and tied to the active spec or audit item.
5. Verify only the surfaces touched, but always include `git diff --check` and `git status --short`.

## Active Path

- Contracts: `blockchain_sm/contracts/ElectionFactoryV1.sol`, `blockchain_sm/contracts/ElectionV1.sol`.
- Backend: `WebApplication3/WebApplication3/WebApplication3/Controllers/ElectionV1Controller.cs`, `Services/ElectionV1*.cs`, `Data/ElectionV1StoreDbContext.cs`.
- Frontend: active ElectionV1 pages, API clients, Web3 context, QR/OTP verification, and sanitizer utilities.
- Infra: `docker-compose.active.yml`, `docker/`, `.env.example`, `blockchain_sm/.env.example`.

Legacy account-abstraction, old private-chain, paymaster, session-key, and old test UI surfaces are frozen unless the task is cleanup/removal.

## Verification Matrix

Contracts:

```powershell
cd blockchain_sm
npm run compile
npm test
```

Backend:

```powershell
dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm run build
```

Infra:

```powershell
docker compose -f docker-compose.active.yml config
```

Repo hygiene:

```powershell
git diff --check
git status --short
```

## Safety

- Never inspect or print secret values from `.env`, private key files, local appsettings secrets, or wallet material.
- Treat all election integrity code as high risk until proven otherwise.
- Do not treat skipped Foundry/Slither checks as successful validation.
- Do not use live Sepolia keys or deploy/finalize transactions without explicit user confirmation.
- When changing UX, preserve backend security messages and do not bypass server-side validation.
