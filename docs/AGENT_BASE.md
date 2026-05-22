# Agent Context Base - HoLiHu Blockchain Election

Status: Active

Last verified: 2026-05-22

Purpose: give AI-assisted engineering agents a compact, source-backed starting base for this repository. This file is not a replacement for `AGENTS.md`, nested `AGENTS.md`, the Spec Kit constitution, or active specs. Treat it as a navigation and judgment aid, then verify against the live code before editing.

## How To Use This Base

This base follows the large-codebase setup pattern from Anthropic's Claude Code article: keep always-loaded context lean, layer context by path, use skills on demand, and search the live filesystem instead of trusting a stale index.

Recommended order:

1. Read `AGENTS.md`.
2. Read `docs/CODEBASE_MAP.md`.
3. Read the nested `AGENTS.md` for the module you will touch.
4. For security, ElectionV1, infra, or cross-surface work, use `.agents/skills/blockchain-election-maintenance/SKILL.md`.
5. For large or security-sensitive work, read `.specify/memory/constitution.md`, `docs/audit/SECURITY_VERIFICATION_2026-05-20.md`, `docs/audit/AUDIT_2026-05-18.md`, and the relevant `.specify/specs/<feature>/` docs.
6. Use `rg`/symbol search to confirm the current source. Do not rely only on docs.

Keep `AGENTS.md` lean. Put reusable workflows in skills, path-specific rules in nested `AGENTS.md`, and detailed remediation history in `docs/audit/` or `.specify/`.

## Source Of Truth Priority

Use this priority when documents disagree:

1. Current source code and tests.
2. Root and nested `AGENTS.md`.
3. `.specify/memory/constitution.md`.
4. `docs/ARCHITECTURE.md`.
5. `docs/audit/SECURITY_VERIFICATION_2026-05-20.md` and current `REMEDIATION_DOT*.md`.
6. Active feature spec under `.specify/specs/`.
7. Older runbooks and historical review docs.

Known drift:

- `SYSTEM_MODERNIZATION_REVIEW_2026-04-10.md` is historical and partially stale.
- `docs/audit/REMEDIATION_BACKLOG.md` is useful as an index, but some status text lags the actual spec/source state.
- Some specs still say `Draft` even when later commits/docs indicate implementation or verification happened. Verify with source, git history, and remediation docs.

## Active System Shape

The active product is a student election system using ElectionV1 commit-reveal on Sepolia or local Anvil.

Active path:

- Contracts: `blockchain_sm/contracts/ElectionFactoryV1.sol` and `blockchain_sm/contracts/ElectionV1.sol`.
- Backend: `WebApplication3/WebApplication3/WebApplication3/`, especially `Program.cs`, `Controllers/ElectionV1Controller.cs`, `Services/ElectionV1*.cs`, and `Data/ElectionV1StoreDbContext.cs`.
- Frontend: `frontend/src/routes/AppRoutes.tsx`, `frontend/src/routes/paths.ts`, `frontend/src/api/electionV1Api.ts`, `frontend/src/context/Web3Context.tsx`, active pages, and `frontend/src/utils/sanitizeHtml.ts`.
- Infra: `docker-compose.active.yml` plus `docker/`.

Legacy account-abstraction/private-chain runtime surfaces have been removed from the active backend and frontend. Do not reintroduce EntryPoint, paymaster, session-key, old private geth, or old test UI behavior unless a future spec explicitly restores an archived legacy path.

## Core ElectionV1 Flow

The active flow is:

1. Admin creates an election/roster draft in the frontend.
2. Backend stores roster draft and invite metadata in PostgreSQL or development fallback.
3. Voter opens QR/invite link through `/verify-voter`.
4. Backend verifies identity with OTP, rate limiting, lockout, and account binding.
5. Voter binds wallet with a signed message.
6. Admin deploys ElectionV1 contracts through the backend helper scripts.
7. Voters commit on-chain using Merkle eligibility proofs.
8. Voters reveal on-chain using the original vote secret.
9. Election is finalized with explicit turnout semantics.

Election integrity invariants:

- Commitments are domain-separated by chain, election address, voter, candidate, and salt.
- Eligibility is Merkle based.
- Double commit, double reveal, replay, invalid candidate, and commitment mismatch paths must stay blocked.
- Vote-secret storage must not regress to plaintext localStorage.
- Reveal must verify the stored vote envelope belongs to the connected wallet.

## Security Baseline

As of `docs/audit/SECURITY_VERIFICATION_2026-05-20.md`, no open Critical finding is documented.

Resolved/high-risk areas:

- S1 secrets/private keys in tracked source.
- S2/S6 OTP hashing, development echo gating, lockout, and rate limiting.
- S3 JWT fail-fast secret configuration and no hardcoded fallback.
- S4/S5 encrypted vote-secret envelope and wallet-owner check before reveal.
- S8 DOMPurify sanitization.
- S9 turnout/finalize semantics.
- S10 config-driven CORS.
- S13 invite/account binding.
- S15-S17 infra/tooling hardening.
- reCAPTCHA verification now fails closed against `RecaptchaSettings`, with the old 2Captcha/bypass code removed.
- S19 Node engine pin.
- S20 path/version documentation fixes.

Remaining non-blocker notes:

- S14 timestamp skew is accepted for testnet context.
- S18 backend warning/RNG cleanup is resolved as of 2026-05-22: `dotnet build ... --no-incremental` reports 0 warnings.
- Production must use a real secret store, enable reCAPTCHA, and consider login endpoint rate limiting before mainnet.

If a new Critical is found, it blocks release.

## Current Frontend Routing Base

On branch `014-path-standardization`, `frontend/src/routes/paths.ts` is the source of truth for canonical frontend paths.

Current convention:

- New links use English kebab-case paths such as `/app/elections/new`, `/app/dashboard`, `/privacy`, and `/contact`.
- Vietnamese/old paths stay as backward-compatible redirects.
- UI copy remains Vietnamese-first unless the task is developer docs or localization.
- Dynamic ID routes are not broadly refactored unless the active spec says so.

Do not hardcode new route strings when `PATHS` can be used.

## Module Verification Commands

Use the smallest meaningful set for touched paths, then always report exact commands and results.

Contracts:

```powershell
cd blockchain_sm
npm run compile
npm test
```

Backend:

```powershell
dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug --no-incremental
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm run build
```

Frontend active-path gate when full typecheck is too noisy or out of scope:

```powershell
cd frontend
npm run typecheck:active
```

Infra:

```powershell
docker compose -f docker-compose.active.yml config
```

Repository hygiene:

```powershell
git diff --check
git status --short
```

Reusable active-stack harness:

```powershell
./scripts/verify-active.ps1
```

Use `-IncludeTypecheck` only on Node 20/22 LTS; Node 25 has timed out on `npm run typecheck:active` in this workspace. Use `-IncludeDependencyAudit` when the network/package registries are available and you want npm/NuGet vulnerability checks in the same gate.

Tooling constraints:

- Use Node 20 or 22 LTS. Node 25 is outside the supported baseline.
- Use local Hardhat through npm scripts. Do not use `npx hardhat`.
- Foundry and Slither may be unavailable. A skipped tool is not a successful validation.
- Do not print `.env`, private keys, JWT secrets, OTPs, wallet material, or runtime deployment secrets.

## Change Strategy

Default posture for edits:

- Make assumptions explicit.
- Keep changes surgical and spec-scoped.
- Prefer existing patterns over new abstractions.
- Do not refactor unrelated code.
- Do not broaden legacy behavior.
- Add or adjust tests only in proportion to risk.
- Preserve Vietnamese-first user-facing copy.
- For architecture-sensitive, security-sensitive, or multi-surface work, go through Spec Kit.

Before editing, identify the surface and verify the current source with `rg`. After editing, run the relevant command gate and repository hygiene checks.
