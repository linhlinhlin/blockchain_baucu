# AGENTS.md

Applies to: ASP.NET Core backend work under `WebApplication3/WebApplication3/WebApplication3/`.

## Context

The backend targets `net9.0`. The active path is `/api/election-v1/*` backed by ElectionV1 services and PostgreSQL store. Legacy account-abstraction/private-chain services have been removed; keep wallet DB lookup separate from ElectionV1 chain writes.

## Commands

From repository root:

```powershell
dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug
```

When EF migration behavior is changed, also validate design-time context creation and document the provider used.

## Rules

- Fail closed for missing JWT secrets, unsafe CORS, disabled auth assumptions, and production config gaps.
- OTP, invite tokens, refresh tokens, and vote-related secrets must be hashed or otherwise protected according to the active spec.
- Do not echo sensitive development-only values unless an explicit development flag allows it.
- Keep active ElectionV1 services separate from legacy blockchain services.
- Do not commit real `appsettings.Development.json`, production settings, local DB files, logs, or publish output.

## Review Focus

- AuthN/AuthZ, JWT configuration, refresh token handling.
- OTP rate limiting, lockout, hashing, and bind-to-account behavior.
- Wallet binding and admin wallet ownership checks.
- ElectionV1 store boundaries and migration safety.
- CORS, rate limiting, hosted services, and Docker/env overrides.
