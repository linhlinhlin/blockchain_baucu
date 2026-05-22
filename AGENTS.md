# AGENTS.md

Status: Active

Owner: Project maintainers

Last updated: 2026-05-19

Applies to: Codex, Claude Code, CodeRabbit, and other AI-assisted engineering agents working in this repository.

This is the repository-level instruction source for `blockchain_baucu`. Keep this file lean. Put broad invariants here, path-specific guidance in nested `AGENTS.md` files, and detailed remediation context in `docs/` or `.specify/`.

## Repository Context

HoLiHu Blockchain Election is a student election system with an active ElectionV1 commit-reveal path.

Primary modules:

- `blockchain_sm/`: Hardhat 2.22, Foundry, Solidity 0.8.28, OpenZeppelin v5. Active contracts are `ElectionFactoryV1` and `ElectionV1`; `legacy/` is frozen.
- `WebApplication3/WebApplication3/WebApplication3/`: ASP.NET Core `net9.0` backend. Active API surface is `/api/election-v1/*`.
- `frontend/`: React 18, Vite 6, TypeScript, ethers v6. Active pages cover ElectionV1 creation, management, user elections, voter verification, and QR scanning.
- `docker/` and `docker-compose.active.yml`: active local stack with PostgreSQL 17, .NET 9 backend, and Vite dev frontend.

Before large or risky work, read:

- `docs/CODEBASE_MAP.md`
- `.specify/memory/constitution.md`
- `docs/audit/AUDIT_2026-05-18.md`
- the active spec under `.specify/specs/<feature>/`

`SYSTEM_MODERNIZATION_REVIEW_2026-04-10.md` is historical and partially stale. Prefer the May 2026 audit docs and branch-specific remediation docs for current truth.

## Operating Rules

- Security and election integrity are non-negotiable. Any open Critical finding blocks release.
- Do not commit secrets, keys, OTPs, JWT secrets, RPC credentials, private wallet material, `.env`, local appsettings secrets, or generated deployment artifacts.
- Treat `.env`, `blockchain_sm/.env`, frontend env files, runtime databases, logs, and local chain/deployment outputs as sensitive local state.
- Keep changes surgical and spec-scoped. Do not mix smart contract behavior, backend auth, frontend UX, infra, and legacy cleanup unless the spec explicitly requires it.
- Active path is `ElectionFactoryV1`/`ElectionV1` plus ASP.NET Core backend plus React/Vite frontend. Do not expand the legacy account-abstraction stack.
- Preserve Vietnamese-first user-facing copy unless the task is explicitly localization or developer-only documentation.
- For architecture-sensitive, security-sensitive, or multi-surface work, use Spec Kit: `speckit-specify` -> `speckit-plan` -> `speckit-tasks` -> implementation.
- If using Spec Kit from Codex, follow the global `$speckit-codex` guidance and avoid re-initializing over existing `.specify/` files without reviewing diffs.

## Verification Commands

Use the smallest meaningful verification set for the changed paths and report exact commands plus results.

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

Active stack:

```powershell
docker compose -f docker-compose.active.yml config
```

Repository hygiene:

```powershell
git diff --check
git status --short
```

Notes:

- Use Node 20 or 22 LTS. Node 25 is not a supported baseline for Vite 6/Hardhat 2.
- Use local Hardhat through npm scripts. Do not use `npx hardhat`, because it can pull Hardhat 3 and fail with HHE22.
- Foundry/Slither may be missing locally; do not treat silently skipped analysis as a full validation pass.

## Agent Harness

- Read the nested `AGENTS.md` in `blockchain_sm/`, `frontend/`, and `WebApplication3/WebApplication3/WebApplication3/` when working there.
- Use `.agents/skills/blockchain-election-maintenance/SKILL.md` for security remediation, ElectionV1, cross-surface flow, Spec Kit, and active-stack changes.
- Use `docs/CODEBASE_MAP.md` as the quick map before opening many files.

## Review Guidelines

- Treat private keys, JWT, OTP, wallet binding, invite tokens, vote secrets, Merkle eligibility, commit/reveal/finalize, CORS, deployment scripts, and Docker/env wiring as high-risk.
- For smart contracts, verify phase boundaries, domain separation, replay/double-vote protection, quorum/finalize semantics, and event/audit behavior.
- For backend changes, verify authentication, authorization, rate limits, hashed secrets, tenant/election boundaries, DTO exposure, and config fail-closed behavior.
- For frontend changes, verify XSS safety, localStorage/sessionStorage handling, wallet address matching, MetaMask/Sepolia UX, accessibility, and responsive behavior.
- For infra changes, verify non-root containers, healthchecks, persistent deployment artifacts, env examples, and rollback notes.
- Automated review does not replace human ownership. Resolve or explicitly defer every security-relevant finding before merge.
